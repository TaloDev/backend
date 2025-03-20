import { APIKeyScope } from '../../src/entities/api-key'
import createSocketIdentifyMessage from '../utils/createSocketIdentifyMessage'
import GameChannelFactory from '../fixtures/GameChannelFactory'
import Redis from 'ioredis'
import redisConfig from '../../src/config/redis.config'
import createTestSocket from '../utils/createTestSocket'

describe('Socket rate limiting', () => {
  it('should return a rate limiting error', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])
    const channel = await new GameChannelFactory(player.game).one()
    channel.members.add(player.aliases[0])
    await global.em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client, socket) => {
      await client.identify(identifyMessage)

      const conn = socket.findConnections((conn) => conn.playerAliasId === player.aliases[0].id)[0]
      const redis = new Redis(redisConfig)
      await redis.set(`requests.${conn.rateLimitKey}`, 999)
      await redis.quit()

      client.sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: channel.id
          },
          message: 'Hello world'
        }
      })
      await client.expectJsonToStrictEqual({
        res: 'v1.error',
        data: {
          req: 'unknown',
          message: 'Rate limit exceeded',
          errorCode: 'RATE_LIMIT_EXCEEDED'
        }
      })
    })
  })

  it('should disconnect connections after 3 warnings', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])
    const channel = await new GameChannelFactory(player.game).one()
    channel.members.add(player.aliases[0])
    await global.em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client, socket) => {
      await client.identify(identifyMessage)

      const conn = socket.findConnections((conn) => conn.playerAliasId === player.aliases[0].id)[0]
      conn.rateLimitWarnings = 3

      const redis = new Redis(redisConfig)
      await redis.set(`requests.${conn.rateLimitKey}`, 999)
      await redis.quit()

      client.sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: channel.id
          },
          message: 'Hello world'
        }
      })
      await client.expectClosed(1008, 'RATE_LIMIT_EXCEEDED')
    })
  })
})
