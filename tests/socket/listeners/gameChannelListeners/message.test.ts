import { APIKeyScope } from '../../../../src/entities/api-key'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import createSocketIdentifyMessage from '../../../utils/createSocketIdentifyMessage'
import createTestSocket from '../../../utils/createTestSocket'

describe('Game channel listeners - message', () => {
  it('should successfully send a message', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS,
    ])

    const channel = await new GameChannelFactory(player.game).one()
    channel.members.add(player.aliases[0])

    await em.persist(channel).flush()

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      client.sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: channel.id,
          },
          message: 'Hello world',
        },
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
      APIKeyScope.WRITE_GAME_CHANNELS,
    ])

    const channel = await new GameChannelFactory(player.game).one()

    await em.persist(channel).flush()

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      client.sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: channel.id,
          },
          message: 'Hello world',
        },
      })
      await client.expectJsonToStrictEqual({
        res: 'v1.error',
        data: {
          req: 'v1.channels.message',
          message: 'An error occurred while processing the message',
          errorCode: 'LISTENER_ERROR',
          cause: 'Player not in channel',
        },
      })
    })
  })

  it('should correctly use the cached empty members list', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS,
    ])

    const channel = await new GameChannelFactory(player.game).one()

    await em.persist(channel).flush()

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)

      const messagePayload = {
        req: 'v1.channels.message',
        data: { channel: { id: channel.id }, message: 'Hello world' },
      }
      const expectedError = {
        res: 'v1.error',
        data: {
          req: 'v1.channels.message',
          message: 'An error occurred while processing the message',
          errorCode: 'LISTENER_ERROR',
          cause: 'Player not in channel',
        },
      }

      // first request populates the empty members cache
      client.sendJson(messagePayload)
      await client.expectJsonToStrictEqual(expectedError)

      // second request hits the cached empty members list
      client.sendJson(messagePayload)
      await client.expectJsonToStrictEqual(expectedError)
    })
  })

  it('should successfully send a message using cached channel data', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS,
    ])

    const channel = await new GameChannelFactory(player.game).one()
    channel.members.add(player.aliases[0])

    await em.persist(channel).flush()

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)

      // first message populates the existence, members, and data caches
      client.sendJson({
        req: 'v1.channels.message',
        data: { channel: { id: channel.id }, message: 'first' },
      })
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.message')
      })

      // second message hits all three cached paths
      client.sendJson({
        req: 'v1.channels.message',
        data: { channel: { id: channel.id }, message: 'second' },
      })
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.message')
        expect(actual.data.channel.id).toBe(channel.id)
        expect(actual.data.message).toBe('second')
        expect(actual.data.playerAlias.id).toBe(player.aliases[0].id)
      })
    })
  })

  it('should receive an error if the channel does not exist', async () => {
    const { identifyMessage, ticket } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS,
    ])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      client.sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: 999,
          },
          message: 'Hello world',
        },
      })
      await client.expectJsonToStrictEqual({
        res: 'v1.error',
        data: {
          req: 'v1.channels.message',
          message: 'An error occurred while processing the message',
          errorCode: 'LISTENER_ERROR',
          cause: 'Channel not found',
        },
      })
    })
  })
})
