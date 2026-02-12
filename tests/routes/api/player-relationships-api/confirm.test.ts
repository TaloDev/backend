import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerAliasSubscriptionFactory from '../../../fixtures/PlayerAliasSubscriptionFactory'
import PlayerAliasSubscription from '../../../../src/entities/player-alias-subscription'
import createSocketIdentifyMessage, { persistTestSocketTicket } from '../../../utils/createSocketIdentifyMessage'
import createTestSocket, { createTestClient } from '../../../utils/createTestSocket'

describe('Player relationships API service - confirm', () => {
  it('should confirm a pending subscription request', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persist([player1, player2]).flush()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .pending()
      .one()
    await em.persist(subscription).flush()

    const res = await request(app)
      .put(`/v1/players/relationships/${subscription.id}/confirm`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscription.confirmed).toBe(true)
    expect(res.body.subscription.id).toBe(subscription.id)
  })

  it('should not confirm a subscription if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .pending()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    await request(app)
      .put(`/v1/players/relationships/${subscription.id}/confirm`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(403)
  })

  it('should not confirm a subscription if the alias does not exist', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])

    const res = await request(app)
      .put('/v1/players/relationships/123456/confirm')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '999')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not confirm a subscription that does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .put('/v1/players/relationships/2312321/confirm')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Subscription request not found')
  })

  it('should not confirm a subscription that is not pending', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    const res = await request(app)
      .put(`/v1/players/relationships/${subscription.id}/confirm`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Subscription request not found')
  })

  it('should not confirm a subscription for another player', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .pending()
      .one()
    await em.persist([player1, player2, player3, subscription]).flush()

    const res = await request(app)
      .put(`/v1/players/relationships/${subscription.id}/confirm`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player3.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Subscription request not found')
  })

  it('should confirm both subscriptions when confirming a bidirectional request where reciprocal is pending', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    // player 1 sends bidirectional request to player 2
    const subscription1 = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .bidirectional()
      .pending()
      .one()

    // player 2 also sends bidirectional request to player 1
    const subscription2 = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .bidirectional()
      .pending()
      .one()

    await em.persist([player1, player2, subscription1, subscription2]).flush()

    // player 2 confirms player 1's request
    const res = await request(app)
      .put(`/v1/players/relationships/${subscription1.id}/confirm`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player2.aliases[0].id))
      .expect(200)

    expect(res.body.subscription.confirmed).toBe(true)
    expect(res.body.subscription.id).toBe(subscription1.id)

    // verify the reciprocal subscription (subscription2) was also confirmed
    await em.refresh(subscription2)
    expect(subscription2.confirmed).toBe(true)
  })

  it('should create a reciprocal subscription when confirming a bidirectional request with no existing reciprocal', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    // player 1 sends bidirectional request to player 2
    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .bidirectional()
      .pending()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    // player 2 confirms player 1's request
    const res = await request(app)
      .put(`/v1/players/relationships/${subscription.id}/confirm`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player2.aliases[0].id))
      .expect(200)

    expect(res.body.subscription.confirmed).toBe(true)
    expect(res.body.subscription.id).toBe(subscription.id)

    const reciprocal = await em.repo(PlayerAliasSubscription).findOneOrFail({
      subscriber: player2.aliases[0],
      subscribedTo: player1.aliases[0]
    })

    expect(reciprocal.confirmed).toBe(true)
    expect(reciprocal.relationshipType).toBe('bidirectional')
  })

  it('should not create a reciprocal subscription when confirming a unidirectional request', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .unidirectional()
      .pending()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    await request(app)
      .put(`/v1/players/relationships/${subscription.id}/confirm`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player2.aliases[0].id))
      .expect(200)

    const reciprocal = await em.repo(PlayerAliasSubscription).findOne({
      subscriber: player2.aliases[0],
      subscribedTo: player1.aliases[0]
    })
    expect(reciprocal).toBeNull()
  })

  it('should notify the subscriber when their subscription is confirmed', async () => {
    const { identifyMessage: identifyMessage1, ticket: ticket1, player: player1, apiKey, token } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_PLAYER_RELATIONSHIPS,
      APIKeyScope.WRITE_PLAYER_RELATIONSHIPS
    ])
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player2).flush()

    const { identifyMessage: identifyMessage2, ticket: ticket2 } = await persistTestSocketTicket(apiKey, player2)

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .unidirectional()
      .pending()
      .one()
    await em.persist(subscription).flush()

    await createTestSocket(`/?ticket=${ticket1}`, async (client1, _wss, port) => {
      const client2 = await createTestClient(port, `/?ticket=${ticket2}`, { waitForReady: false })

      await client1.identify(identifyMessage1)
      await client2.identify(identifyMessage2)

      await request(app)
        .put(`/v1/players/relationships/${subscription.id}/confirm`)
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player2.aliases[0].id))
        .expect(200)

      await client1.expectJson((actual) => {
        expect(actual.res).toBe('v1.player-relationships.subscription-confirmed')
        expect(actual.data.subscription.id).toBe(subscription.id)
        expect(actual.data.subscription.confirmed).toBe(true)
        expect(actual.data.subscription.subscriber.id).toBe(player1.aliases[0].id)
        expect(actual.data.subscription.subscribedTo.id).toBe(player2.aliases[0].id)
      })
    })
  })
})
