import { getGlobalRedis } from '../../src/config/redis.config.js'
import APIKey, { APIKeyScope } from '../../src/entities/api-key.js'
import Player from '../../src/entities/player.js'
import { createSocketTicket } from '../../src/lib/sockets/createSocketTicket.js'
import PlayerFactory from '../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from './createAPIKeyAndToken.js'

export type IdentifyMessage = {
  req: 'v1.players.identify'
  data: {
    playerAliasId: number
    socketToken: string
  }
}

type SocketIdentifyData = {
  identifyMessage: IdentifyMessage
  ticket: string
  player: Player
  apiKey: APIKey
  token: string
}

export async function persistTestSocketTicket(
  apiKey: APIKey,
  player: Player,
): Promise<Pick<SocketIdentifyData, 'identifyMessage' | 'ticket'>> {
  const redis = getGlobalRedis()
  const ticket = await createSocketTicket(redis, apiKey, false)
  const socketToken = await player.aliases[0].createSocketToken(redis)

  return {
    identifyMessage: {
      req: 'v1.players.identify',
      data: {
        playerAliasId: player.aliases[0].id,
        socketToken,
      },
    },
    ticket,
  }
}

export default async function createSocketIdentifyMessage(
  scopes: APIKeyScope[] = [],
): Promise<SocketIdentifyData> {
  const [apiKey, token] = await createAPIKeyAndToken(scopes)
  const player = await new PlayerFactory([apiKey.game]).one()
  await em.persist(player).flush()

  const { identifyMessage, ticket } = await persistTestSocketTicket(apiKey, player)

  return {
    identifyMessage,
    ticket,
    player,
    apiKey,
    token,
  }
}
