import { EntityManager } from '@mikro-orm/mysql'
import APIKey, { APIKeyScope } from '../../src/entities/api-key'
import PlayerFactory from '../fixtures/PlayerFactory'
import createAPIKeyAndToken from './createAPIKeyAndToken'
import Redis from 'ioredis'
import redisConfig from '../../src/config/redis.config'
import Player from '../../src/entities/player'
import { createSocketTicket } from '../../src/services/api/socket-ticket-api.service'

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

export default async function createSocketIdentifyMessage(scopes: APIKeyScope[] = []): Promise<SocketIdentifyData> {
  const [apiKey, token] = await createAPIKeyAndToken(scopes)
  const player = await new PlayerFactory([apiKey.game]).one()
  await (<EntityManager>global.em).persistAndFlush(player)

  const redis = new Redis(redisConfig)
  const ticket = await createSocketTicket(redis, apiKey, false)
  const socketToken = await player.aliases[0].createSocketToken(redis)
  await redis.quit()

  return {
    identifyMessage: {
      req: 'v1.players.identify',
      data: {
        playerAliasId: player.aliases[0].id,
        socketToken
      }
    },
    ticket,
    player,
    apiKey,
    token
  }
}
