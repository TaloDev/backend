import APIKey, { APIKeyScope } from '../../../../src/entities/api-key'
import createSocketIdentifyMessage, { persistTestSocketTicket } from '../../../utils/createSocketIdentifyMessage'
import createTestSocket, { createTestClient } from '../../../utils/createTestSocket'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerAliasSubscriptionFactory from '../../../fixtures/PlayerAliasSubscriptionFactory'

describe('Player relationship listeners - broadcast', () => {
  it('should broadcast to multiple confirmed subscribers', async () => {
    const { identifyMessage, ticket, player, apiKey } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYER_BROADCASTS,
      APIKeyScope.READ_PLAYER_BROADCASTS
    ])

    const subscriber1 = await new PlayerFactory([apiKey.game]).one()
    const subscriber2 = await new PlayerFactory([apiKey.game]).one()

    const subscription1 = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(subscriber1.aliases[0])
      .withSubscribedTo(player.aliases[0])
      .confirmed()
      .one()
    const subscription2 = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(subscriber2.aliases[0])
      .withSubscribedTo(player.aliases[0])
      .confirmed()
      .one()
    await em.persist([subscriber1, subscriber2, subscription1, subscription2]).flush()

    const { identifyMessage: sub1IdentifyMessage, ticket: sub1Ticket } = await persistTestSocketTicket(apiKey, subscriber1)
    const { identifyMessage: sub2IdentifyMessage, ticket: sub2Ticket } = await persistTestSocketTicket(apiKey, subscriber2)

    await createTestSocket(`/?ticket=${ticket}`, async (broadcaster, _wss, port) => {
      const sub1Client = await createTestClient(port, `/?ticket=${sub1Ticket}`, { waitForReady: false })
      const sub2Client = await createTestClient(port, `/?ticket=${sub2Ticket}`, { waitForReady: false })

      await broadcaster.identify(identifyMessage)
      await sub1Client.identify(sub1IdentifyMessage)
      await sub2Client.identify(sub2IdentifyMessage)

      broadcaster.sendJson({
        req: 'v1.player-relationships.broadcast',
        data: {
          message: 'Hello everyone!'
        }
      })

      await sub1Client.expectJson((actual) => {
        expect(actual.res).toBe('v1.player-relationships.broadcast')
        expect(actual.data.message).toBe('Hello everyone!')
      })

      await sub2Client.expectJson((actual) => {
        expect(actual.res).toBe('v1.player-relationships.broadcast')
        expect(actual.data.message).toBe('Hello everyone!')
      })
    })
  })

  it('should not broadcast to pending subscribers', async () => {
    const { identifyMessage, ticket, player, apiKey } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYER_BROADCASTS,
      APIKeyScope.READ_PLAYER_BROADCASTS
    ])

    const subscriber = await new PlayerFactory([apiKey.game]).one()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(subscriber.aliases[0])
      .withSubscribedTo(player.aliases[0])
      .pending()
      .one()
    await em.persist([subscriber, subscription]).flush()

    const { identifyMessage: subscriberIdentifyMessage, ticket: subscriberTicket } = await persistTestSocketTicket(apiKey, subscriber)

    await createTestSocket(`/?ticket=${ticket}`, async (broadcaster, _wss, port) => {
      const subscriberClient = await createTestClient(port, `/?ticket=${subscriberTicket}`, { waitForReady: false })

      await broadcaster.identify(identifyMessage)
      await subscriberClient.identify(subscriberIdentifyMessage)

      broadcaster.sendJson({
        req: 'v1.player-relationships.broadcast',
        data: {
          message: 'Hello subscribers!'
        }
      })

      await subscriberClient.dontExpectJson((actual) => {
        expect(actual.res).toBe('v1.player-relationships.broadcast')
      })
    })
  })

  it('should not broadcast to non-subscribers', async () => {
    const { identifyMessage, ticket, apiKey } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYER_BROADCASTS,
      APIKeyScope.READ_PLAYER_BROADCASTS
    ])

    const nonSubscriber = await new PlayerFactory([apiKey.game]).one()
    await em.persist(nonSubscriber).flush()

    const { identifyMessage: nonSubIdentifyMessage, ticket: nonSubTicket } = await persistTestSocketTicket(apiKey, nonSubscriber)

    await createTestSocket(`/?ticket=${ticket}`, async (broadcaster, _wss, port) => {
      const nonSubClient = await createTestClient(port, `/?ticket=${nonSubTicket}`, { waitForReady: false })

      await broadcaster.identify(identifyMessage)
      await nonSubClient.identify(nonSubIdentifyMessage)

      broadcaster.sendJson({
        req: 'v1.player-relationships.broadcast',
        data: {
          message: 'Hello subscribers!'
        }
      })

      await nonSubClient.dontExpectJson((actual) => {
        expect(actual.res).toBe('v1.player-relationships.broadcast')
      })
    })
  })

  it('should receive an error if the WRITE_PLAYER_BROADCASTS scope is missing', async () => {
    const { identifyMessage, ticket } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS
    ])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      client.sendJson({
        req: 'v1.player-relationships.broadcast',
        data: {
          message: 'Hello subscribers!'
        }
      })

      await client.expectJsonToStrictEqual({
        res: 'v1.error',
        data: {
          req: 'v1.player-relationships.broadcast',
          message: 'Missing access key scope(s): write:playerBroadcasts',
          errorCode: 'MISSING_ACCESS_KEY_SCOPES'
        }
      })
    })
  })

  it('should only broadcast to subscribers with the READ_PLAYER_SUBSCRIPTIONS scope', async () => {
    const { identifyMessage, ticket, player, apiKey } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYER_BROADCASTS,
      APIKeyScope.READ_PLAYER_BROADCASTS
    ])

    const apiKeyWithScope = new APIKey(apiKey.game, apiKey.createdByUser)
    apiKeyWithScope.scopes = [APIKeyScope.READ_PLAYERS, APIKeyScope.READ_PLAYER_BROADCASTS]

    const apiKeyNoScope = new APIKey(apiKey.game, apiKey.createdByUser)
    apiKeyNoScope.scopes = [APIKeyScope.READ_PLAYERS]

    const subscriberWithScope = await new PlayerFactory([apiKey.game]).one()
    const subscriberNoScope = await new PlayerFactory([apiKey.game]).one()
    await em.persist([apiKeyWithScope, apiKeyNoScope, subscriberWithScope, subscriberNoScope]).flush()

    const subscriptionWithScope = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(subscriberWithScope.aliases[0])
      .withSubscribedTo(player.aliases[0])
      .confirmed()
      .one()
    const subscriptionNoScope = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(subscriberNoScope.aliases[0])
      .withSubscribedTo(player.aliases[0])
      .confirmed()
      .one()
    await em.persist([subscriptionWithScope, subscriptionNoScope]).flush()

    const { identifyMessage: withScopeIdentify, ticket: withScopeTicket } = await persistTestSocketTicket(apiKeyWithScope, subscriberWithScope)
    const { identifyMessage: noScopeIdentify, ticket: noScopeTicket } = await persistTestSocketTicket(apiKeyNoScope, subscriberNoScope)

    await createTestSocket(`/?ticket=${ticket}`, async (broadcaster, _wss, port) => {
      const withScopeClient = await createTestClient(port, `/?ticket=${withScopeTicket}`, { waitForReady: false })
      const noScopeClient = await createTestClient(port, `/?ticket=${noScopeTicket}`, { waitForReady: false })

      await broadcaster.identify(identifyMessage)
      await withScopeClient.identify(withScopeIdentify)
      await noScopeClient.identify(noScopeIdentify)

      broadcaster.sendJson({
        req: 'v1.player-relationships.broadcast',
        data: {
          message: 'Hello subscribers!'
        }
      })

      await withScopeClient.expectJson((actual) => {
        expect(actual.res).toBe('v1.player-relationships.broadcast')
        expect(actual.data.message).toBe('Hello subscribers!')
      })

      await noScopeClient.dontExpectJson((actual) => {
        expect(actual.res).toBe('v1.player-relationships.broadcast')
      })
    })
  })

  it('should validate message data', async () => {
    const { identifyMessage, ticket } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYER_BROADCASTS
    ])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      client.sendJson({
        req: 'v1.player-relationships.broadcast',
        data: {
          // missing 'message' field
        }
      })

      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.error')
        expect(actual.data.errorCode).toBe('INVALID_MESSAGE_DATA')
      })
    })
  })
})
