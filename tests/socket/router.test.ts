import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'
import { APIKeyScope } from '../../src/entities/api-key'
import createSocketIdentifyMessage from '../utils/createSocketIdentifyMessage'
import GameChannelFactory from '../fixtures/GameChannelFactory'
import { createSocketTicket } from '../../src/services/api/socket-ticket-api.service'
import createTestSocket from '../utils/createTestSocket'

describe('Socket router', () => {
  it('should reject invalid messages', async () => {
    const [apiKey] = await createAPIKeyAndToken([])
    const ticket = await createSocketTicket(redis, apiKey, false)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson({
        blah: 'blah'
      })
      await client.expectJsonToStrictEqual({
        res: 'v1.error',
        data: {
          req: 'unknown',
          message: 'Invalid message request',
          errorCode: 'INVALID_MESSAGE',
          cause: '{"blah":"blah"}'
        }
      })
    })
  })

  it('should reject unknown requests', async () => {
    const [apiKey] = await createAPIKeyAndToken([])
    const ticket = await createSocketTicket(redis, apiKey, false)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson({
        req: 'v1.magic',
        data: {}
      })
      await client.expectJsonToStrictEqual({
        res: 'v1.error',
        data: {
          req: 'unknown',
          message: 'Invalid message request',
          errorCode: 'INVALID_MESSAGE',
          cause: '{"req":"v1.magic","data":{}}'
        }
      })
    })
  })

  it('should reject requests where a player is required but one hasn\'t been identified yet', async () => {
    const [apiKey] = await createAPIKeyAndToken([])
    const ticket = await createSocketTicket(redis, apiKey, false)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: 1
          },
          message: 'Hello world'
        }
      })
      await client.expectJsonToStrictEqual({
        res: 'v1.error',
        data: {
          req: 'v1.channels.message',
          message: 'You must identify a player before sending this request',
          errorCode: 'NO_PLAYER_FOUND'
        }
      })
    })
  })

  it('should reject requests where a scope is required but is not present', async () => {
    const { identifyMessage, ticket } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)

      client.sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: 1
          },
          message: 'Hello world'
        }
      })
      await client.expectJsonToStrictEqual({
        res: 'v1.error',
        data: {
          req: 'v1.channels.message',
          message: 'Missing access key scope(s): write:gameChannels',
          errorCode: 'MISSING_ACCESS_KEY_SCOPES'
        }
      })
    })
  })

  it('should be able to accept requests where a scope is required and the key has the full access scope', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([APIKeyScope.FULL_ACCESS])
    const channel = await new GameChannelFactory(player.game).one()
    channel.members.add(player.aliases[0])
    await em.persist(channel).flush()

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

  it('should reject requests where the payload fails the listener\'s validation', async () => {
    const { identifyMessage, ticket } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)

      client.sendJson({
        req: 'v1.channels.message',
        data: {
          channel: {
            id: 1
          },
          myMessageToTheChannelIsGoingToBeThis: 'Hello world'
        }
      })
      await client.expectJsonToStrictEqual({
        res: 'v1.error',
        data: {
          req: 'v1.channels.message',
          message: 'Invalid message data for request',
          errorCode: 'INVALID_MESSAGE_DATA',
          cause: '{"channel":{"id":1},"myMessageToTheChannelIsGoingToBeThis":"Hello world"}'
        }
      })
    })
  })
})
