import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerAliasSubscription from '../../../../src/entities/player-alias-subscription'
import PlayerAliasSubscriptionFactory from '../../../fixtures/PlayerAliasSubscriptionFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import createSocketIdentifyMessage, {
  persistTestSocketTicket,
} from '../../../utils/createSocketIdentifyMessage'
import createTestSocket, { createTestClient } from '../../../utils/createTestSocket'

describe('Player relationship API - delete', () => {
  it('should delete a subscription', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    await request(app)
      .delete(`/v1/players/relationships/${subscription.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(204)

    const deletedSubscription = await em
      .repo(PlayerAliasSubscription)
      .findOne(subscription.id, { refresh: true })
    expect(deletedSubscription).toBeNull()
  })

  it('should delete a pending subscription', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .pending()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    await request(app)
      .delete(`/v1/players/relationships/${subscription.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(204)

    const deletedSubscription = await em
      .repo(PlayerAliasSubscription)
      .findOne(subscription.id, { refresh: true })
    expect(deletedSubscription).toBeNull()
  })

  it('should not delete a subscription if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    await request(app)
      .delete(`/v1/players/relationships/${subscription.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(403)
  })

  it('should not delete a subscription if the alias does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])

    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    const res = await request(app)
      .delete(`/v1/players/relationships/${subscription.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '999')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not delete a subscription that does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .delete('/v1/players/relationships/214324')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Subscription not found')
  })

  it("should not delete another player's subscription", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, player3, subscription]).flush()

    const res = await request(app)
      .delete(`/v1/players/relationships/${subscription.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player3.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Subscription not found')

    const updatedSubscription = await em
      .repo(PlayerAliasSubscription)
      .findOne(subscription.id, { refresh: true })
    expect(updatedSubscription).not.toBeNull()
  })

  it('should delete a unidirectional subscription without looking for a reciprocal', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .unidirectional()
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    await request(app)
      .delete(`/v1/players/relationships/${subscription.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(204)

    const deleted = await em
      .repo(PlayerAliasSubscription)
      .findOne(subscription.id, { refresh: true })
    expect(deleted).toBeNull()
  })

  it('should delete both subscriptions when deleting a bidirectional relationship', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    const subscription1 = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .bidirectional()
      .confirmed()
      .one()

    const subscription2 = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .bidirectional()
      .confirmed()
      .one()

    await em.persist([player1, player2, subscription1, subscription2]).flush()

    await request(app)
      .delete(`/v1/players/relationships/${subscription1.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(204)

    const deleted1 = await em
      .repo(PlayerAliasSubscription)
      .findOne(subscription1.id, { refresh: true })
    const deleted2 = await em
      .repo(PlayerAliasSubscription)
      .findOne(subscription2.id, { refresh: true })
    expect(deleted1).toBeNull()
    expect(deleted2).toBeNull()
  })

  it('should notify both players when a subscription is deleted', async () => {
    const {
      identifyMessage: identifyMessage1,
      ticket: ticket1,
      player: player1,
      apiKey,
      token: token1,
    } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_PLAYER_RELATIONSHIPS,
      APIKeyScope.WRITE_PLAYER_RELATIONSHIPS,
    ])
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player2).flush()

    const { identifyMessage: identifyMessage2, ticket: ticket2 } = await persistTestSocketTicket(
      apiKey,
      player2,
    )

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .unidirectional()
      .confirmed()
      .one()
    await em.persist(subscription).flush()

    await createTestSocket(`/?ticket=${ticket1}`, async (client1, _wss, port) => {
      const client2 = await createTestClient(port, `/?ticket=${ticket2}`, { waitForReady: false })

      await client1.identify(identifyMessage1)
      await client2.identify(identifyMessage2)

      await request(app)
        .delete(`/v1/players/relationships/${subscription.id}`)
        .auth(token1, { type: 'bearer' })
        .set('x-talo-alias', String(player1.aliases[0].id))
        .expect(204)

      await client1.expectJson((actual) => {
        expect(actual.res).toBe('v1.player-relationships.subscription-deleted')
        expect(actual.data.subscription.id).toBe(subscription.id)
        expect(actual.data.subscription.subscriber.id).toBe(player1.aliases[0].id)
        expect(actual.data.subscription.subscribedTo.id).toBe(player2.aliases[0].id)
        expect(actual.data.reciprocalSubscription).toBeNull()
      })

      await client2.expectJson((actual) => {
        expect(actual.res).toBe('v1.player-relationships.subscription-deleted')
        expect(actual.data.subscription.id).toBe(subscription.id)
        expect(actual.data.subscription.subscriber.id).toBe(player1.aliases[0].id)
        expect(actual.data.subscription.subscribedTo.id).toBe(player2.aliases[0].id)
        expect(actual.data.reciprocalSubscription).toBeNull()
      })
    })
  })
})
