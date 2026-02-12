import { Context, Next } from 'koa'
import { isAPIRoute } from '../lib/routing/route-info'
import { EntityManager, FilterQuery, Loaded } from '@mikro-orm/mysql'
import PlayerAlias, { PlayerAliasService } from '../entities/player-alias'
import { verify } from '../lib/auth/jwt'

type PlayerAliasPartial = Loaded<PlayerAlias, 'player.auth', 'id' | 'player.auth' | 'player.id'>

export async function playerAuthMiddleware(ctx: Context, next: Next) {
  if (isAPIRoute(ctx) && (ctx.state.currentPlayerId || ctx.state.currentAliasId)) {
    const conditions: FilterQuery<PlayerAlias>[] = [
      ctx.state.currentAliasId ? {
        id: ctx.state.currentAliasId as number
      } : {},
      ctx.state.currentPlayerId ? {
        player: {
          id: ctx.state.currentPlayerId as string
        }
      } : {}
    ].filter((x) => Object.keys(x).length > 0)

    const alias = await (ctx.em as EntityManager)
      .fork()
      .repo(PlayerAlias)
      .findOne({
        $and: [
          {
            $or: conditions
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

export async function validateAuthSessionToken(ctx: Context, alias: PlayerAliasPartial) {
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

export function throwInvalidSessionError(ctx: Context) {
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
) {
  if (!alias.player.auth) return false
  if (!alias.player.auth.sessionKey) return false

  try {
    const payload = await verify<{ playerId: string, aliasId: number }>(sessionToken, alias.player.auth.sessionKey)
    return payload.playerId === expectedPlayerId && payload.aliasId === expectedAliasId
  } catch {
    return false
  }
}
