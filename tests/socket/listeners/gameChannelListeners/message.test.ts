import request from 'superwstest'
import Socket from '../../../../src/socket'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createSocketIdentifyMessage from '../../../utils/requestAuthedSocket'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import { EntityManager } from '@mikro-orm/mysql'

describe('Game channel listeners - message', () => {
  let socket: Socket

  beforeAll(() => {
    socket = new Socket(global.server, global.em)
  })

  afterAll(() => {
    socket.getServer().close()
  })

  it('should successfully send a message', async () => {
    const [identifyMessage, token, player] = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_GAME_CHANNELS])
    const channel = await new GameChannelFactory(player.game).one()
    channel.members.add(player.aliases[0])
    await (<EntityManager>global.em).persistAndFlush(channel)

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson()
      .sendJson(identifyMessage)
      .expectJson()
      .sendJson({
        req: 'v1.channels.message',
        data: {
          channelName: channel.name,
          message: 'Hello world'
        }
      })
      .expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.message')
        expect(actual.data.channelName).toBe(channel.name)
        expect(actual.data.message).toBe('Hello world')
        expect(actual.data.fromPlayerAlias.id).toBe(player.aliases[0].id)
      })
  })

  it('should receive an error if the player is not in the channel', async () => {
    const [identifyMessage, token, player] = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_GAME_CHANNELS])
    const channel = await new GameChannelFactory(player.game).one()
    await (<EntityManager>global.em).persistAndFlush(channel)

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson()
      .sendJson(identifyMessage)
      .expectJson()
      .sendJson({
        req: 'v1.channels.message',
        data: {
          channelName: channel.name,
          message: 'Hello world'
        }
      })
      .expectJson({
        res: 'v1.error',
        data: {
          req: 'v1.channels.message',
          message: 'An error occurred while processing the message',
          errorCode: 'LISTENER_ERROR',
          cause: 'Player not in channel'
        }
      })
      .close()
  })

  it('should receive an error if the channel does not exist', async () => {
    const [identifyMessage, token] = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_GAME_CHANNELS])

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson()
      .sendJson(identifyMessage)
      .expectJson()
      .sendJson({
        req: 'v1.channels.message',
        data: {
          channelName: 'Guild chat',
          message: 'Hello world'
        }
      })
      .expectJson({
        res: 'v1.error',
        data: {
          req: 'v1.channels.message',
          message: 'An error occurred while processing the message',
          errorCode: 'LISTENER_ERROR',
          cause: 'Channel not found'
        }
      })
      .close()
  })
})
