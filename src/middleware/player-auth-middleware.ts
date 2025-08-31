import { Context, Next } from 'koa'
import { isAPIRoute } from './route-middleware'
import { EntityManager } from '@mikro-orm/mysql'
import PlayerAlias, { PlayerAliasService } from '../entities/player-alias'
import { verify } from '../lib/auth/jwt'

export default async function playerAuthMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isAPIRoute(ctx) && (ctx.state.currentPlayerId || ctx.state.currentAliasId)) {
    const em: EntityManager = ctx.em
    let alias: PlayerAlias | null = null

    if (ctx.state.currentPlayerId) {
      alias = await em.getRepository(PlayerAlias).findOne({
        service: PlayerAliasService.TALO,
        player: {
          id: ctx.state.currentPlayerId,
          game: ctx.state.game
        }
      }, {
        populate: ['player.auth']
      })
    } else {
      alias = await em.getRepository(PlayerAlias).findOne({
        id: ctx.state.currentAliasId,
        service: PlayerAliasService.TALO,
        player: {
          game: ctx.state.game
        }
      }, {
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
      ctx.em,
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
  em: EntityManager,
  sessionToken: string,
  alias: PlayerAlias,
  expectedPlayerId: string,
  expectedAliasId: number
): Promise<boolean> {
  await em.populate(alias, ['player.auth'])
  if (!alias.player.auth) return false

  const payload = await verify<{ playerId: string, aliasId: number }>(sessionToken, alias.player.auth.sessionKey!)
  return payload.playerId === expectedPlayerId && payload.aliasId === expectedAliasId
}
