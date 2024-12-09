import { EntityManager } from '@mikro-orm/mysql'
import { APIKeyScope } from '../../src/entities/api-key'
import PlayerFactory from '../fixtures/PlayerFactory'
import createAPIKeyAndToken from './createAPIKeyAndToken'
import Redis from 'ioredis'
import redisConfig from '../../src/config/redis.config'
import Player from '../../src/entities/player'

type IdentifyMessage = {
  req: 'v1.players.identify'
  data: {
    playerAliasId: number
    socketToken: string
  }
}

export default async function createSocketIdentifyMessage(scopes: APIKeyScope[]): Promise<[IdentifyMessage, string, Player]> {
  const [apiKey, token] = await createAPIKeyAndToken(scopes)
  const player = await new PlayerFactory([apiKey.game]).one()
  await (<EntityManager>global.em).persistAndFlush(player)

  const redis = new Redis(redisConfig)
  const socketToken = await player.aliases[0].createSocketToken(redis)
  await redis.quit()

  return [
    {
      req: 'v1.players.identify',
      data: {
        playerAliasId: player.aliases[0].id,
        socketToken: socketToken
      }
    },
    token,
    player
  ]
}
