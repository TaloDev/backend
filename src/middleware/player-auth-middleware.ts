import { Context, Next } from 'koa'
import { isAPIRoute } from './route-middleware'
import { EntityManager } from '@mikro-orm/mysql'
import PlayerAlias, { PlayerAliasService } from '../entities/player-alias'
import { verify } from '../lib/auth/jwt'
import { getResultCacheOptions } from '../lib/perf/getResultCacheOptions'

export default async function playerAuthMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isAPIRoute(ctx) && (ctx.state.currentPlayerId || ctx.state.currentAliasId)) {
    const em: EntityManager = ctx.em
    let alias: PlayerAlias | null = null

    if (ctx.state.currentPlayerId) {
      alias = await em.getRepository(PlayerAlias).findOne({
        player: ctx.state.currentPlayerId,
        service: PlayerAliasService.TALO
      }, getResultCacheOptions(`auth-middleware-player-${ctx.state.currentPlayerId}`, 10_000))
    } else {
      alias = await em.getRepository(PlayerAlias).findOne({
        id: ctx.state.currentAliasId,
        service: PlayerAliasService.TALO
      }, getResultCacheOptions(`auth-middleware-alias-${ctx.state.currentAliasId}`, 10_000))
    }

    if (alias) {
      await validateAuthSessionToken(ctx, alias)
    }
  }

  await next()
}

export async function validateAuthSessionToken(ctx: Context, alias: PlayerAlias): Promise<void> {
  await (ctx.em as EntityManager).populate(alias, ['player.auth'])

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
