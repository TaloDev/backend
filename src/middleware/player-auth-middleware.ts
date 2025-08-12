import { Context, Next } from 'koa'
import { isAPIRoute } from './route-middleware'
import { EntityManager } from '@mikro-orm/mysql'
import PlayerAlias, { PlayerAliasService } from '../entities/player-alias'
import { verify } from '../lib/auth/jwt'
import { getResultCacheOptions } from '../lib/perf/getResultCacheOptions'

export function getAuthMiddlewarePlayerKey(playerId: string) {
  return `auth-middleware-player-${playerId}`
}

export function getAuthMiddlewareAliasKey(aliasId: number) {
  return `auth-middleware-alias-${aliasId}`
}

export default async function playerAuthMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isAPIRoute(ctx) && (ctx.state.currentPlayerId || ctx.state.currentAliasId)) {
    const em: EntityManager = ctx.em
    let alias: PlayerAlias | null = null

    if (ctx.state.currentPlayerId) {
      alias = await em.getRepository(PlayerAlias).findOne({
        player: ctx.state.currentPlayerId,
        service: PlayerAliasService.TALO
      }, {
        ...getResultCacheOptions(getAuthMiddlewarePlayerKey(ctx.state.currentPlayerId), 60_000),
        populate: ['player.auth']
      })
    } else {
      alias = await em.getRepository(PlayerAlias).findOne({
        id: ctx.state.currentAliasId,
        service: PlayerAliasService.TALO
      }, {
        ...getResultCacheOptions(getAuthMiddlewareAliasKey(ctx.state.currentAliasId), 60_000),
        populate: ['player.auth']
      })
    }

    if (alias) {
      await validateAuthSessionToken(ctx, alias)
    }
  }

  await next()
}

export async function validateAuthSessionToken(ctx: Context, alias: PlayerAlias): Promise<void> {
  const sessionToken = ctx.headers['x-talo-session']
  if (!sessionToken) {
    ctx.throw(401, {
      message: 'The x-talo-session header is required for this player',
      errorCode: 'MISSING_SESSION'
    })
  }

  try {
    const valid = await validateSessionTokenJWT(
      sessionToken as string,
      alias,
      ctx.state.currentPlayerId,
      ctx.state.currentAliasId
    )
    if (!valid) {
      throw new Error()
    }
  } catch (err) {
    ctx.throw(401, {
      message: 'The x-talo-session header is invalid',
      errorCode: 'INVALID_SESSION'
    })
  }
}

export async function validateSessionTokenJWT(
  sessionToken: string,
  alias: PlayerAlias,
  expectedPlayerId: string,
  expectedAliasId: number
): Promise<boolean> {
  const payload = await verify<{ playerId: string, aliasId: number }>(sessionToken, alias.player.auth!.sessionKey!)
  return payload.playerId === expectedPlayerId && payload.aliasId === expectedAliasId
}
