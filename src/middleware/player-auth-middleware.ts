import { Context, Next } from 'koa'
import { isAPIRoute } from './route-middleware'
import { EntityManager, Loaded } from '@mikro-orm/mysql'
import PlayerAlias, { PlayerAliasService } from '../entities/player-alias'
import { verify } from '../lib/auth/jwt'

type PlayerAliasPartial = Loaded<PlayerAlias, 'player.auth', 'id' | 'player.auth' | 'player.id'>

export default async function playerAuthMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isAPIRoute(ctx) && (ctx.state.currentPlayerId || ctx.state.currentAliasId)) {
    const alias = await (ctx.em as EntityManager)
      .fork()
      .repo(PlayerAlias)
      .findOne({
        $and: [
          {
            $or: [
              {
                id: ctx.state.currentAliasId
              },
              {
                player: {
                  id: ctx.state.currentPlayerId
                }
              }
            ]
          },
          {
            service: PlayerAliasService.TALO,
            player: {
              game: ctx.state.game
            }
          }
        ]
      }, {
        populate: ['player.auth'],
        fields: ['id', 'player.id', 'player.auth']
      })

    if (alias) {
      await validateAuthSessionToken(ctx, alias)
    }
  }

  await next()
}

export async function validateAuthSessionToken(ctx: Context, alias: PlayerAliasPartial): Promise<void> {
  const sessionToken = ctx.headers['x-talo-session']
  if (!sessionToken) {
    ctx.throw(401, {
      message: 'The x-talo-session header is required for this player',
      errorCode: 'MISSING_SESSION'
    })
  }

  const valid = await validateSessionTokenJWT(
    ctx.em,
    sessionToken as string,
    alias,
    ctx.state.currentPlayerId,
    ctx.state.currentAliasId
  )
  if (!valid) {
    throwInvalidSessionError(ctx)
  }
}

export function throwInvalidSessionError(ctx: Context): void {
  ctx.throw(401, {
    message: 'The x-talo-session header is invalid',
    errorCode: 'INVALID_SESSION'
  })
}

export async function validateSessionTokenJWT(
  em: EntityManager,
  sessionToken: string,
  alias: PlayerAliasPartial,
  expectedPlayerId: string,
  expectedAliasId: number
): Promise<boolean> {
  if (!alias.player.auth) return false
  if (!alias.player.auth.sessionKey) return false

  try {
    const payload = await verify<{ playerId: string, aliasId: number }>(sessionToken, alias.player.auth.sessionKey)
    return payload.playerId === expectedPlayerId && payload.aliasId === expectedAliasId
  } catch {
    return false
  }
}
