import request from 'superwstest'
import Socket from '../../src/socket'
import { APIKeyScope } from '../../src/entities/api-key'
import createSocketIdentifyMessage from '../utils/requestAuthedSocket'
import GameChannelFactory from '../fixtures/GameChannelFactory'
import { EntityManager } from '@mikro-orm/mysql'
import Redis from 'ioredis'
import redisConfig from '../../src/config/redis.config'

describe('Socket rate limiting', () => {
  let socket: Socket

  beforeAll(() => {
    socket = new Socket(global.server, global.em)
    global.ctx.wss = socket
  })

  afterAll(() => {
    socket.getServer().close()
  })

  it('should return a rate limiting error', async () => {
    const [identifyMessage, token, player] = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])
    const channel = await new GameChannelFactory(player.game).one()
    channel.members.add(player.aliases[0])
    await (<EntityManager>global.em).persistAndFlush(channel)

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson()
      .sendJson(identifyMessage)
      .expectJson()
      .exec(async () => {
        const conn = socket.findConnections((conn) => conn.playerAliasId === player.aliases[0].id)[0]

        const redis = new Redis(redisConfig)
        await redis.set(`requests.${conn.rateLimitKey}`, 999)
        await redis.quit()
      })
      .sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: channel.id
          },
          message: 'Hello world'
        }
      })
      .expectJson({
        res: 'v1.error',
        data: {
          req: 'unknown',
          message: 'Rate limit exceeded',
          errorCode: 'RATE_LIMIT_EXCEEDED'
        }
      })
      .close()
  })

  it('should disconnect connections after 3 warnings', async () => {
    const [identifyMessage, token, player] = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])
    const channel = await new GameChannelFactory(player.game).one()
    channel.members.add(player.aliases[0])
    await (<EntityManager>global.em).persistAndFlush(channel)

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson()
      .sendJson(identifyMessage)
      .expectJson()
      .exec(async () => {
        const conn = socket.findConnections((conn) => conn.playerAliasId === player.aliases[0].id)[0]
        conn.rateLimitWarnings = 3

        const redis = new Redis(redisConfig)
        await redis.set(`requests.${conn.rateLimitKey}`, 999)
        await redis.quit()
      })
      .sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: channel.id
          },
          message: 'Hello world'
        }
      })
      .expectClosed(1008, 'RATE_LIMIT_EXCEEDED')
  })
})
