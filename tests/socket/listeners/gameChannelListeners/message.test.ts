import { APIKeyScope } from '../../../../src/entities/api-key'
import createSocketIdentifyMessage from '../../../utils/createSocketIdentifyMessage'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import createTestSocket from '../../../utils/createTestSocket'

describe('Game channel listeners - message', () => {
  it('should successfully send a message', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])
    const channel = await new GameChannelFactory(player.game).one()
    channel.members.add(player.aliases[0])
    await global.em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      client.sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: channel.id
          },
          message: 'Hello world'
        }
      })
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.message')
        expect(actual.data.channel.id).toBe(channel.id)
        expect(actual.data.message).toBe('Hello world')
        expect(actual.data.playerAlias.id).toBe(player.aliases[0].id)
      })
    })
  })

  it('should receive an error if the player is not in the channel', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])
    const channel = await new GameChannelFactory(player.game).one()
    await global.em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
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
          req: 'v1.channels.message',
          message: 'An error occurred while processing the message',
          errorCode: 'LISTENER_ERROR',
          cause: 'Player not in channel'
        }
      })
    })
  })

  it('should receive an error if the channel does not exist', async () => {
    const { identifyMessage, ticket } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      client.sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: 999
          },
          message: 'Hello world'
        }
      })
      await client.expectJsonToStrictEqual({
        res: 'v1.error',
        data: {
          req: 'v1.channels.message',
          message: 'An error occurred while processing the message',
          errorCode: 'LISTENER_ERROR',
          cause: 'Channel not found'
        }
      })
    })
  })
})
