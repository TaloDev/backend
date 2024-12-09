import { Context, Next } from 'koa'
import jwt from 'jsonwebtoken'
import { isAPIRoute } from './route-middleware'
import { EntityManager } from '@mikro-orm/mysql'
import PlayerAlias, { PlayerAliasService } from '../entities/player-alias'
import { promisify } from 'util'
import { PlayerAuthErrorCode } from '../entities/player-auth'

export default async function playerAuthMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isAPIRoute(ctx) && (ctx.state.currentPlayerId || ctx.state.currentAliasId)) {
    const em: EntityManager = ctx.em
    let alias: PlayerAlias | null = null

    if (ctx.state.currentPlayerId) {
      alias = await em.getRepository(PlayerAlias).findOne({
        player: ctx.state.currentPlayerId,
        service: PlayerAliasService.TALO
      })
    } else {
      alias = await em.getRepository(PlayerAlias).findOne({
        id: ctx.state.currentAliasId,
        service: PlayerAliasService.TALO
      })
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
      errorCode: PlayerAuthErrorCode.MISSING_SESSION
    })
  }

  try {
    if (!await validateSessionTokenJWT(sessionToken as string, alias)) {
      throw new Error()
    }
  } catch (err) {
    ctx.throw(401, {
      message: 'The x-talo-session header is invalid',
      errorCode: PlayerAuthErrorCode.INVALID_SESSION
    })
  }
}

export async function validateSessionTokenJWT(sessionToken: string, alias: PlayerAlias): Promise<boolean> {
  const payload = await promisify(jwt.verify)(sessionToken, alias.player.auth.sessionKey)
  return payload.playerId === alias.player.id && payload.aliasId === alias.id
}
