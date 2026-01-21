import { Next } from 'koa'
import { RefinementCtx, z as zodLib } from 'zod'
import GameStat from '../../../entities/game-stat'
import PlayerGameStat from '../../../entities/player-game-stat'
import { ProtectedRouteContext } from '../../../lib/routing/context'
import { GameRouteState } from '../../../middleware/game-middleware'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue'

type Z = typeof zodLib

type StatSchemaData = {
  maxChange?: number | null
  minValue?: number | null
  maxValue?: number | null
  defaultValue?: number
}

function validateStatBody(data: StatSchemaData, ctx: RefinementCtx) {
  if (typeof data.maxChange === 'number' && data.maxChange <= 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'maxChange must be greater than 0',
      path: ['maxChange']
    })
  }

  if (typeof data.minValue === 'number' && typeof data.maxValue === 'number' && data.minValue >= data.maxValue) {
    ctx.addIssue({
      code: 'custom',
      message: 'minValue must be less than maxValue',
      path: ['minValue']
    })
  }

  if (data.defaultValue !== undefined) {
    const min = data.minValue ?? -Infinity
    const max = data.maxValue ?? Infinity
    if (data.defaultValue < min || data.defaultValue > max) {
      ctx.addIssue({
        code: 'custom',
        message: 'defaultValue must be between minValue and maxValue',
        path: ['defaultValue']
      })
    }
  }
}

function statFields(z: Z) {
  return {
    name: z.string(),
    global: z.boolean(),
    maxChange: z.number().nullable().optional(),
    minValue: z.number().nullable().optional(),
    maxValue: z.number().nullable().optional(),
    defaultValue: z.number(),
    minTimeBetweenUpdates: z.number()
  }
}

export function createStatBodySchema(z: Z) {
  return z.object({
    internalName: z.string(),
    ...statFields(z)
  }).superRefine(validateStatBody)
}

export function updateStatBodySchema(z: Z) {
  return z.object(statFields(z)).partial().superRefine(validateStatBody)
}

export type StatRouteState = GameRouteState & { stat: GameStat }
type StatRouteContext = ProtectedRouteContext<StatRouteState>

export type PlayerStatRouteState = StatRouteState & { playerStat: PlayerGameStat }
type PlayerStatRouteContext = ProtectedRouteContext<PlayerStatRouteState>

export const loadStat = async (ctx: StatRouteContext, next: Next) => {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const stat = await em.repo(GameStat).findOne(Number(id), { populate: ['game'] })

  if (!stat) {
    ctx.throw(404, 'Stat not found')
  }

  const userOrganisation = ctx.state.authenticatedUser.organisation
  if (stat.game.organisation.id !== userOrganisation.id) {
    ctx.throw(403)
  }

  ctx.state.stat = stat
  ctx.state.game = stat.game
  await next()
}

export const loadPlayerStat = async (ctx: PlayerStatRouteContext, next: Next) => {
  const { playerStatId } = ctx.params as { playerStatId: string }
  const em = ctx.em

  const playerStat = await em.repo(PlayerGameStat).findOne({
    id: Number(playerStatId),
    stat: ctx.state.stat
  }, {
    populate: ['player']
  })

  if (!playerStat) {
    ctx.throw(404, 'Player stat not found')
  }

  ctx.state.playerStat = playerStat
  await next()
}

export const clearStatIndexResponseCache = async (ctx: StatRouteContext, next: Next) => {
  await next()
  await deferClearResponseCache(GameStat.getIndexCacheKey(ctx.state.game, true))
}
