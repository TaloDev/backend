import { Next } from 'koa'
import assert from 'node:assert'
import { RefinementCtx, ZodType, z as zod } from 'zod'
import GameStat from '../../../entities/game-stat.js'
import PlayerGameStat from '../../../entities/player-game-stat.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { ProtectedRouteContext } from '../../../lib/routing/context.js'
import { GameRouteState } from '../../../middleware/game-middleware.js'

type StatSchemaData = {
  maxChange?: number | null
  minValue?: number | null
  maxValue?: number | null
  defaultValue?: number
}

type StatRouteState = { stat: GameStat }
type StatRouteContext = ProtectedRouteContext<StatRouteState>

type PlayerStatRouteContext = ProtectedRouteContext<StatRouteState & { playerStat: PlayerGameStat }>

type ClearStatIndexResponseCacheContext = ProtectedRouteContext<
  Partial<StatRouteState> & Partial<GameRouteState>
>

function validateStatBody(data: StatSchemaData, ctx: RefinementCtx) {
  if (typeof data.maxChange === 'number' && data.maxChange <= 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'maxChange must be greater than 0',
      path: ['maxChange'],
    })
  }

  if (
    typeof data.minValue === 'number' &&
    typeof data.maxValue === 'number' &&
    data.minValue >= data.maxValue
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'minValue must be less than maxValue',
      path: ['minValue'],
    })
  }

  if (data.defaultValue !== undefined) {
    const min = data.minValue ?? -Infinity
    const max = data.maxValue ?? Infinity
    if (data.defaultValue < min || data.defaultValue > max) {
      ctx.addIssue({
        code: 'custom',
        message: 'defaultValue must be between minValue and maxValue',
        path: ['defaultValue'],
      })
    }
  }
}

function statFields(z: typeof zod) {
  return {
    name: z.string().meta({ description: 'The display name of the stat' }),
    global: z
      .boolean()
      .meta({ description: 'Whether the stat value is shared across all players' }),
    maxChange: z.number().nullable().optional().meta({
      description: 'The maximum allowed change to the stat per update',
    }),
    minValue: z.number().nullable().optional().meta({
      description: 'The minimum value the stat can be set to',
    }),
    maxValue: z.number().nullable().optional().meta({
      description: 'The maximum value the stat can be set to',
    }),
    defaultValue: z.number().meta({ description: 'The default value for the stat' }),
    minTimeBetweenUpdates: z.number().min(0).meta({
      description: 'The minimum time in seconds between updates',
    }),
  }
}

export function createStatBodySchema(z: typeof zod) {
  return z
    .object({
      internalName: z.string().meta({ description: 'The internal name of the stat' }),
      ...statFields(z),
    })
    .superRefine(validateStatBody)
}

function optionalFields(fields: Record<string, ZodType>): Record<string, ZodType> {
  const result: Record<string, ZodType> = {}
  for (const [key, schema] of Object.entries(fields)) {
    const description = schema.meta?.()?.description
    result[key] = schema.optional().meta({ description })
  }
  return result
}

export function updateStatBodySchema(z: typeof zod) {
  return z.object(optionalFields(statFields(z))).superRefine(validateStatBody)
}

export async function loadStat(ctx: StatRouteContext, next: Next) {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const stat = await em.repo(GameStat).findOne(Number(id), { populate: ['game'] })

  if (!stat) {
    return ctx.throw(404, 'Stat not found')
  }

  const userOrganisation = ctx.state.user.organisation
  if (stat.game.organisation.id !== userOrganisation.id) {
    return ctx.throw(403)
  }

  ctx.state.stat = stat
  await next()
}

export async function loadPlayerStat(ctx: PlayerStatRouteContext, next: Next) {
  const { playerStatId } = ctx.params as { playerStatId: string }
  const em = ctx.em

  const playerStat = await em.repo(PlayerGameStat).findOne(
    {
      id: Number(playerStatId),
      stat: ctx.state.stat,
    },
    {
      populate: ['player'],
    },
  )

  if (!playerStat) {
    return ctx.throw(404, 'Player stat not found')
  }

  ctx.state.playerStat = playerStat
  await next()
}

export async function clearStatIndexResponseCache(
  ctx: ClearStatIndexResponseCacheContext,
  next: Next,
) {
  await next()

  const game = ctx.state.game ?? ctx.state.stat?.game
  assert(game)
  await deferClearResponseCache(GameStat.getIndexCacheKey(game, true))
}
