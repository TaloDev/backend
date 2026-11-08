import type Player from '../../entities/player.js'
import { verify } from './jwt.js'

export async function validateSessionTokenJWT({
  sessionToken,
  player,
  playerId,
  aliasId,
}: {
  sessionToken: string
  player: Pick<Player, 'auth'>
  playerId: string
  aliasId: number
}) {
  if (!player.auth?.sessionKey) {
    return false
  }

  try {
    const payload = await verify<{ playerId: string; aliasId: number }>(
      sessionToken,
      player.auth.sessionKey,
    )

    return payload.playerId === playerId && payload.aliasId === aliasId
  } catch {
    return false
  }
}
