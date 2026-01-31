import { Next } from 'koa'
import { RefinementCtx, z } from 'zod'
import GameStat from '../../../entities/game-stat'
import PlayerGameStat from '../../../entities/player-game-stat'
import { ProtectedRouteContext } from '../../../lib/routing/context'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue'
import { GameRouteState } from '../../../middleware/game-middleware'
import assert from 'node:assert'

type Z = typeof z

type StatSchemaData = {
  maxChange?: number | null
  minValue?: number | null
  maxValue?: number | null
  defaultValue?: number
}

type StatRouteState = { stat: GameStat }
type StatRouteContext = ProtectedRouteContext<StatRouteState>

type PlayerStatRouteContext = ProtectedRouteContext<
  StatRouteState & { playerStat: PlayerGameStat }
>

type ClearStatIndexResponseCacheContext = ProtectedRouteContext<
  Partial<StatRouteState> & Partial<GameRouteState>
>

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
    minTimeBetweenUpdates: z.number().min(0)
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

export const loadStat = async (ctx: StatRouteContext, next: Next) => {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const stat = await em.repo(GameStat).findOne(Number(id), { populate: ['game'] })

  if (!stat) {
    ctx.throw(404, 'Stat not found')
  }

  const userOrganisation = ctx.state.user.organisation
  if (stat.game.organisation.id !== userOrganisation.id) {
    ctx.throw(403)
  }

  ctx.state.stat = stat
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

export const clearStatIndexResponseCache = async (ctx: ClearStatIndexResponseCacheContext, next: Next) => {
  await next()

  const game = ctx.state.game ?? ctx.state.stat?.game
  assert(game)
  await deferClearResponseCache(GameStat.getIndexCacheKey(game, true))
}
