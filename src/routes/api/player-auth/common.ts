import type { Next } from 'koa'
import type { APIRouteContext } from '../../../lib/routing/context'
import APIKey from '../../../entities/api-key'
import PlayerAlias from '../../../entities/player-alias'
import Player from '../../../entities/player'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../entities/player-auth-activity'

export type PlayerAuthRouteState = {
  alias: PlayerAlias
}

export async function loadAliasWithAuth(ctx: APIRouteContext<PlayerAuthRouteState>, next: Next) {
  const alias = await ctx.em.repo(PlayerAlias).findOneOrFail({
    id: ctx.state.currentAliasId,
    player: {
      game: ctx.state.game
    }
  }, {
    populate: ['player.auth']
  })

  ctx.state.alias = alias

  await next()
}

export function getRedisAuthKey(key: APIKey, alias: PlayerAlias): string {
  return `player-auth:${key.game.id}:verification:${alias.id}`
}

export function getRedisPasswordResetKey(key: APIKey, code: string): string {
  return `player-auth:${key.game.id}:password-reset:${code}`
}

export function handleFailedLogin(ctx: APIRouteContext): never {
  ctx.throw(401, { message: 'Incorrect identifier or password', errorCode: 'INVALID_CREDENTIALS' })
}

export function createPlayerAuthActivity(
  ctx: APIRouteContext,
  player: Player,
  data: { type: PlayerAuthActivityType, extra?: Record<string, unknown> }
): PlayerAuthActivity {
  const ip = ctx.request.ip

  const activity = new PlayerAuthActivity(player)
  activity.type = data.type
  activity.extra = {
    ...(data.extra ?? {}),
    userAgent: ctx.request.headers['user-agent'],
    ip: data.type === PlayerAuthActivityType.DELETED_AUTH ? undefined : ip
  }

  ctx.em.persist(activity)

  return activity
}
