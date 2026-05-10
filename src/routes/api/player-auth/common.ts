import type { EntityManager } from '@mikro-orm/mysql'
import type { Next } from 'koa'
import assert from 'node:assert'
import type { APIRouteContext } from '../../../lib/routing/context.js'
import APIKey from '../../../entities/api-key.js'
import Game from '../../../entities/game.js'
import PlayerAlias from '../../../entities/player-alias.js'
import PlayerAuthActivity, {
  PlayerAuthActivityType,
} from '../../../entities/player-auth-activity.js'
import PlayerAuth from '../../../entities/player-auth.js'
import Player from '../../../entities/player.js'
import { buildPlayerAuthActivity } from '../../../lib/logging/buildPlayerAuthActivity.js'

export type PlayerAuthRouteState = {
  alias: PlayerAlias
}

export async function loadAliasWithAuth(ctx: APIRouteContext<PlayerAuthRouteState>, next: Next) {
  const alias = await ctx.em.repo(PlayerAlias).findOneOrFail(
    {
      id: ctx.state.currentAliasId,
      player: {
        game: ctx.state.game,
      },
    },
    {
      populate: ['player.auth'],
    },
  )

  ctx.state.alias = alias

  await next()
}

export function getRedisAuthKey(alias: PlayerAlias) {
  return `player-auth:${alias.player.game.id}:verification:${alias.id}`
}

export function getRedisPasswordResetKey(key: APIKey, code: string) {
  return `player-auth:${key.game.id}:password-reset:${code}`
}

export function createPlayerAuthActivity(
  ctx: APIRouteContext,
  player: Player,
  data: { type: PlayerAuthActivityType; extra?: Record<string, unknown> },
  em: EntityManager = ctx.em,
): PlayerAuthActivity {
  return buildPlayerAuthActivity({
    em,
    player,
    type: data.type,
    ip: ctx.request.ip,
    userAgent: ctx.request.headers['user-agent'],
    extra: data.extra,
  })
}

export function sessionBuilder(alias: PlayerAlias, withRefresh = false) {
  assert(alias.player.auth)
  return alias.player.auth.createSession(alias, withRefresh)
}

export async function isEmailTakenForGame(
  em: EntityManager,
  { email, game, excludePlayer }: { email: string; game: Game; excludePlayer?: Player },
): Promise<boolean> {
  const where: Record<string, unknown> = {
    email,
    player: { game },
  }
  if (excludePlayer) {
    where.player = { game, id: { $ne: excludePlayer.id } }
  }
  const existing = await em.repo(PlayerAuth).findOne(where)
  return existing !== null
}
