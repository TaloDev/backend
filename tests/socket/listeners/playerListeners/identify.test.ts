import request from 'superwstest'
import Socket from '../../../../src/socket'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createSocketIdentifyMessage from '../../../utils/requestAuthedSocket'
import { EntityManager } from '@mikro-orm/mysql'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import Redis from 'ioredis'
import redisConfig from '../../../../src/config/redis.config'

describe('Player listeners - identify', () => {
  let socket: Socket

  beforeAll(() => {
    socket = new Socket(global.server, global.em)
  })

  afterAll(() => {
    socket.getServer().close()
  })

  it('should successfully identify a player', async () => {
    const [identifyMessage, token, player] = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson({
        res: 'v1.connected',
        data: {}
      })
      .sendJson(identifyMessage)
      .expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
        expect(actual.data.id).toBe(player.aliases[0].id)
      })
      .close()
  })

  it('should require the socket token to be valid', async () => {
    const [identifyMessage, token] = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson({
        res: 'v1.connected',
        data: {}
      })
      .sendJson({
        ...identifyMessage,
        data: {
          ...identifyMessage.data,
          socketToken: 'invalid'
        }
      })
      .expectJson({
        res: 'v1.error',
        data: {
          req: 'v1.players.identify',
          message: 'Invalid socket token',
          errorCode: 'INVALID_SOCKET_TOKEN'
        }
      })
      .close()
  })

  it('should require a valid session token to identify Talo aliases', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persistAndFlush(player)

    const redis = new Redis(redisConfig)
    const socketToken = await player.aliases[0].createSocketToken(redis)
    await redis.quit()

    const sessionToken = await player.auth.createSession(player.aliases[0])
    await em.flush()

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson({
        res: 'v1.connected',
        data: {}
      })
      .sendJson({
        req: 'v1.players.identify',
        data: {
          playerAliasId: player.aliases[0].id,
          socketToken: socketToken,
          sessionToken: sessionToken
        }
      })
      .expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
        expect(actual.data.id).toBe(player.aliases[0].id)
      })
      .close()
  })

  it('should reject identify for Talo aliases without a valid session token', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persistAndFlush(player)

    const redis = new Redis(redisConfig)
    const socketToken = await player.aliases[0].createSocketToken(redis)
    await redis.quit()

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson({
        res: 'v1.connected',
        data: {}
      })
      .sendJson({
        req: 'v1.players.identify',
        data: {
          playerAliasId: player.aliases[0].id,
          socketToken: socketToken,
          sessionToken: 'blah'
        }
      })
      .expectJson({
        res: 'v1.error',
        data: {
          req: 'v1.players.identify',
          message: 'Invalid session token',
          errorCode: 'INVALID_SESSION_TOKEN'
        }
      })
      .close()
  })
})
