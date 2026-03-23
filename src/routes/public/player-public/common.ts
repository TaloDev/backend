import type { Next } from 'koa'
import type { PublicRouteContext } from '../../../lib/routing/context'
import Game from '../../../entities/game'
import PlayerAlias from '../../../entities/player-alias'
import { sign, verify } from '../../../lib/auth/jwt'

const PUBLIC_SESSION_AUDIENCE = 'player-public'

export type PlayerPublicRouteState = {
  game: Game
}

export async function loadGameFromToken(
  ctx: PublicRouteContext<PlayerPublicRouteState>,
  next: Next,
) {
  const game = await Game.fromToken(ctx.params.token, ctx.em)
  if (!game) {
    return ctx.throw(404, 'Game not found')
  }

  ctx.state.game = game

  await next()
}

export async function buildPublicPlayerSession(alias: PlayerAlias) {
  const sessionToken = await sign(
    { playerId: alias.player.id, aliasId: alias.id },
    process.env.JWT_SECRET!,
    {
      expiresIn: '5m',
      audience: PUBLIC_SESSION_AUDIENCE,
    },
  )
  return { sessionToken }
}

export async function verifyPublicPlayerSession(token: string) {
  try {
    return await verify<{ playerId: string; aliasId: number }>(token, process.env.JWT_SECRET!, {
      audience: PUBLIC_SESSION_AUDIENCE,
    })
  } catch {
    return null
  }
}
