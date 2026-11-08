import type { Context } from 'koa'
import type Player from '../../entities/player.js'
import type { APIRouteContext } from '../routing/context.js'
import PlayerAlias from '../../entities/player-alias.js'

export const CLAIM_KEY_HEADER = 'x-talo-claim-key'
const INVALID_CLAIM_KEY = 'INVALID_CLAIM_KEY'

export function getClaimKey(ctx: Context) {
  const claimKey = ctx.headers[CLAIM_KEY_HEADER]

  if (typeof claimKey !== 'string' || claimKey.length === 0) {
    return undefined
  }

  return claimKey
}

export function checkClaimKeyMatches(
  player: Pick<Player, 'claimKey'>,
  claimKey: string | undefined,
) {
  // skip if the player doesn't have one
  if (!player.claimKey) {
    return true
  }

  return player.claimKey === claimKey
}

export function verifyClaimKey(ctx: Context, alias: Pick<PlayerAlias, 'service' | 'player'>) {
  if (PlayerAlias.isClaimKeyExempt(alias.service)) {
    return
  }

  if (!checkClaimKeyMatches(alias.player, getClaimKey(ctx))) {
    return throwInvalidClaimKey(ctx)
  }
}

export function verifyPlayerClaimKey(ctx: APIRouteContext, player: Player) {
  // playerAuthMiddleware already validated a session for this player
  if (ctx.state.sessionPlayerId === player.id) {
    return
  }

  if (!checkClaimKeyMatches(player, getClaimKey(ctx))) {
    return throwInvalidClaimKey(ctx)
  }
}

export function throwInvalidClaimKey(ctx: Context): never {
  return ctx.throw(401, {
    message: 'The x-talo-claim-key header is missing or invalid',
    errorCode: INVALID_CLAIM_KEY,
  })
}
