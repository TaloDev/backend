import request from 'superwstest'
import Socket from '../../src/socket'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'
import { APIKeyScope } from '../../src/entities/api-key'
import createSocketIdentifyMessage from '../utils/requestAuthedSocket'
import { EntityManager } from '@mikro-orm/mysql'
import GameChannelFactory from '../fixtures/GameChannelFactory'

describe('Socket router', () => {
  let socket: Socket

  beforeAll(() => {
    socket = new Socket(global.server, global.em)
  })

  afterAll(() => {
    socket.getServer().close()
  })

  it('should reject invalid messages', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson({
        res: 'v1.connected',
        data: {}
      })
      .sendJson({
        blah: 'blah'
      })
      .expectJson({
        res: 'v1.error',
        data: {
          req: 'unknown',
          message: 'Invalid message request',
          errorCode: 'INVALID_MESSAGE',
          cause: '{"blah":"blah"}'
        }
      })
      .close()
  })

  it('should reject unknown requests', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson({
        res: 'v1.connected',
        data: {}
      })
      .sendJson({
        req: 'v1.magic',
        data: {}
      })
      .expectJson({
        res: 'v1.error',
        data: {
          req: 'unknown',
          message: 'Invalid message request',
          errorCode: 'INVALID_MESSAGE',
          cause: '{"req":"v1.magic","data":{}}'
        }
      })
      .close()
  })

  it('should reject requests where a player is required but one hasn\'t been identified yet', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson({
        res: 'v1.connected',
        data: {}
      })
      .sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: 1
          },
          message: 'Hello world'
        }
      })
      .expectJson({
        res: 'v1.error',
        data: {
          req: 'v1.channels.message',
          message: 'You must identify a player before sending this request',
          errorCode: 'NO_PLAYER_FOUND'
        }
      })
      .close()
  })

  it('should reject requests where a scope is required but is not present', async () => {
    const [identifyMessage, token] = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson({
        res: 'v1.connected',
        data: {}
      })
      .sendJson(identifyMessage)
      .expectJson()
      .sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: 1
          },
          message: 'Hello world'
        }
      })
      .expectJson({
        res: 'v1.error',
        data: {
          req: 'v1.channels.message',
          message: 'Missing access key scope(s): write:gameChannels',
          errorCode: 'MISSING_ACCESS_KEY_SCOPES'
        }
      })
      .close()
  })

  it('should be able to accept requests where a scope is required and the key has the full access scope', async () => {
    const [identifyMessage, token, player] = await createSocketIdentifyMessage([APIKeyScope.FULL_ACCESS])
    const channel = await new GameChannelFactory(player.game).one()
    channel.members.add(player.aliases[0])
    await (<EntityManager>global.em).persistAndFlush(channel)

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson({
        res: 'v1.connected',
        data: {}
      })
      .sendJson(identifyMessage)
      .expectJson()
      .sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: 1
          },
          message: 'Hello world'
        }
      })
      .expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.message')
        expect(actual.data.channel.id).toBe(channel.id)
        expect(actual.data.message).toBe('Hello world')
        expect(actual.data.playerAlias.id).toBe(player.aliases[0].id)
      })
      .close()
  })

  it('should reject requests where the payload fails the listener\'s validation', async () => {
    const [identifyMessage, token] = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_GAME_CHANNELS])

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson({
        res: 'v1.connected',
        data: {}
      })
      .sendJson(identifyMessage)
      .expectJson()
      .sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: 1
          },
          myMessageToTheChannelIsGoingToBeThis: 'Hello world'
        }
      })
      .expectJson({
        res: 'v1.error',
        data: {
          req: 'v1.channels.message',
          message: 'Invalid message data for request',
          errorCode: 'INVALID_MESSAGE_DATA',
          cause: '{"channel":{"id":1},"myMessageToTheChannelIsGoingToBeThis":"Hello world"}'
        }
      })
      .close()
  })
})
