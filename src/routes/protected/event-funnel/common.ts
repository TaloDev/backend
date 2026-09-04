import type { ClickHouseClient } from '@clickhouse/client'
import type { Next } from 'koa'
import { endOfDay } from 'date-fns'
import { z } from 'zod'
import type Game from '../../../entities/game.js'
import EventFunnel, {
  EventFunnelPropOps,
  EventFunnelPropRule,
  EventFunnelStep,
  EventFunnelStepProps,
} from '../../../entities/event-funnel.js'
import { formatDateForClickHouse } from '../../../lib/clickhouse/formatDateTime.js'
import { ProtectedRouteContext } from '../../../lib/routing/context.js'
import { dateRangeSchema } from '../../../lib/validation/dateRangeSchema.js'
import { GameRouteState } from '../../../middleware/game-middleware.js'

export const FUNNEL_CACHE_TTL = 900

export type FunnelResultStep = {
  eventName: string
  players: number
  percentage: number
  avgSecondsToNext: number | null
}

type FunnelRow = {
  id: string
  t: string
  delta_ms?: string
}

type BuildStepQueryArgs = {
  steps: EventFunnelStep[]
  maxGap: number
  game: Game
  includeDevData: boolean
  startDate: string
  endDate: string
}

type FunnelRouteContext = ProtectedRouteContext<GameRouteState & { funnel: EventFunnel }>

const propRuleSchema = z
  .object({
    key: z.string(),
    op: z.enum(EventFunnelPropOps),
    value: z.array(z.string()),
  })
  .superRefine((rule, ctx) => {
    const expected = rule.op === 'set' ? 0 : rule.op === 'between' ? 2 : 1
    if (rule.value.length !== expected) {
      ctx.addIssue({
        code: 'custom',
        message: `op '${rule.op}' expects ${expected} value(s)`,
        path: ['value'],
      })
    }
  })

const stepSchema = z.object({
  name: z.string(),
  props: z.object({
    ruleMode: z.enum(['and', 'or']),
    rules: z.array(propRuleSchema).max(10),
  }),
})

const stepsSchema = z
  .array(stepSchema)
  .min(2)
  .max(5)
  .superRefine((steps, ctx) => {
    const names = steps.map((step) => step.name)
    if (new Set(names).size !== names.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Step names must be distinct',
      })
    }
  })

const funnelContentSchema = z.object({
  steps: stepsSchema,
  maxGap: z.number().positive().int(),
})

export const funnelSchema = z.object({
  name: z.string().min(1).max(255),
  steps: stepsSchema,
  maxGap: z.number().positive().int(),
})

export const previewSchema = dateRangeSchema.and(funnelContentSchema)

export const updateFunnelSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  steps: stepsSchema.optional(),
  maxGap: z.number().positive().int().optional(),
})

export async function loadFunnel(ctx: FunnelRouteContext, next: Next) {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const funnel = await em.repo(EventFunnel).findOne({ id: Number(id), game: ctx.state.game })

  if (!funnel) {
    return ctx.throw(404, 'Funnel not found')
  }

  ctx.state.funnel = funnel
  await next()
}

function buildRuleClause(
  rule: EventFunnelPropRule,
  prefix: string,
  params: Record<string, unknown>,
) {
  switch (rule.op) {
    case 'set':
      return '1'
    case '=': {
      const v0 = `${prefix}v0`
      params[v0] = rule.value[0]
      return `(prop_value = {${v0}:String} OR (isNotNull(toFloat64OrNull(prop_value)) AND toFloat64OrNull(prop_value) = toFloat64OrNull({${v0}:String})))`
    }
    case '!=': {
      const v0 = `${prefix}v0`
      params[v0] = rule.value[0]
      return `(prop_value <> {${v0}:String} AND (isNull(toFloat64OrNull(prop_value)) OR toFloat64OrNull(prop_value) <> toFloat64OrNull({${v0}:String})))`
    }
    case '>':
    case '>=':
    case '<':
    case '<=': {
      const v0 = `${prefix}v0`
      params[v0] = rule.value[0]
      return `toFloat64OrNull(prop_value) ${rule.op} toFloat64OrNull({${v0}:String})`
    }
    case 'between': {
      const v0 = `${prefix}v0`
      const v1 = `${prefix}v1`
      params[v0] = rule.value[0]
      params[v1] = rule.value[1]
      return `toFloat64OrNull(prop_value) BETWEEN toFloat64OrNull({${v0}:String}) AND toFloat64OrNull({${v1}:String})`
    }
    case 'contains': {
      const v0 = `${prefix}v0`
      params[v0] = rule.value[0]
      return `position(prop_value, {${v0}:String}) > 0`
    }
  }
}

function buildPropsHaving(
  props: EventFunnelStepProps,
  prefix: string,
  params: Record<string, unknown>,
) {
  const conditions = props.rules.map((rule, idx) => {
    const rulePrefix = `${prefix}${idx}_`
    const keyParam = `${rulePrefix}key`
    params[keyParam] = rule.key
    return `countIf(prop_key = {${keyParam}:String} AND ${buildRuleClause(rule, rulePrefix, params)}) > 0`
  })

  return conditions.join(props.ruleMode === 'and' ? ' AND ' : ' OR ')
}

function buildStepQuery(stepIdx: number, args: BuildStepQueryArgs) {
  const { steps, maxGap, game, includeDevData, startDate, endDate } = args
  const step = steps[stepIdx]
  const prefix = `s${stepIdx}`
  const params: Record<string, unknown> = {}

  let sql = `
    SELECT e.player_alias_id AS id, MIN(e.created_at) AS t
    ${stepIdx > 0 ? ', toUnixTimestamp64Milli(MIN(e.created_at)) - toUnixTimestamp64Milli(any(p.t)) AS delta_ms' : ''}
    FROM events e
  `

  if (stepIdx > 0) {
    const prev = buildStepQuery(stepIdx - 1, args)
    Object.assign(params, prev.params)
    sql += `
      INNER JOIN (${prev.sql}) p ON p.id = e.player_alias_id
    `
  }

  params[`${prefix}_name`] = step.name
  params.startDate = startDate
  params.endDate = endDate
  sql += `
    WHERE e.game_id = ${game.id}
      AND e.name = {${prefix}_name:String}
      AND e.created_at BETWEEN {startDate:String} AND {endDate:String}
      ${includeDevData ? '' : 'AND e.dev_build = false'}
  `

  if (stepIdx > 0) {
    params.maxGap = maxGap
    sql += `
      AND e.created_at > p.t
      AND e.created_at <= p.t + toIntervalSecond({maxGap:Int32})
    `
  }

  if (step.props.rules.length > 0) {
    sql += `
      AND e.id IN (
        SELECT event_id
        FROM event_props
        WHERE game_id = ${game.id}
          AND created_at BETWEEN {startDate:String} AND {endDate:String}
        GROUP BY event_id
        HAVING ${buildPropsHaving(step.props, `${prefix}_p_`, params)}
      )
    `
  }

  sql += `
    GROUP BY e.player_alias_id
  `

  return { sql, params }
}

export async function computeFunnel({
  clickhouse,
  game,
  includeDevData,
  steps,
  maxGap,
  startDate,
  endDate,
}: BuildStepQueryArgs & { clickhouse: ClickHouseClient }): Promise<FunnelResultStep[]> {
  const args: BuildStepQueryArgs = {
    steps,
    maxGap,
    game,
    includeDevData,
    startDate: formatDateForClickHouse(new Date(startDate)),
    endDate: formatDateForClickHouse(endOfDay(new Date(endDate))),
  }

  const counts: number[] = []
  const deltas: number[][] = []

  for (let i = 0; i < steps.length; i++) {
    const { sql, params } = buildStepQuery(i, args)
    const rows = await clickhouse
      .query({ query: sql, query_params: params, format: 'JSONEachRow' })
      .then((res) => res.json<FunnelRow>())

    counts.push(rows.length)
    if (i > 0) {
      deltas.push(
        rows.filter((row) => row.delta_ms !== undefined).map((row) => Number(row.delta_ms)),
      )
    }
  }

  const firstCount = counts[0]

  return counts.map((count, i) => {
    const nextDeltas = deltas[i]
    const avgSecondsToNext =
      i < steps.length - 1 && nextDeltas.length > 0
        ? nextDeltas.reduce((sum, delta) => sum + delta, 0) / nextDeltas.length / 1000
        : null

    return {
      eventName: steps[i].name,
      players: count,
      percentage: firstCount === 0 ? 0 : Math.round((count / firstCount) * 10_000) / 100,
      avgSecondsToNext,
    }
  })
}
