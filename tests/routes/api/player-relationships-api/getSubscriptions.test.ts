import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerAliasSubscriptionFactory from '../../../fixtures/PlayerAliasSubscriptionFactory'
import { RelationshipType } from '../../../../src/entities/player-alias-subscription'

describe('Player relationships API  - getSubscriptions', () => {
  it('should get confirmed subscriptions', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .confirmed()
      .one()
    const subscription2 = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player3.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, player3, subscription, subscription2]).flush()

    const res = await request(app)
      .get('/v1/players/relationships/subscriptions')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(2)
    expect(res.body.count).toBe(2)
    expect(res.body.isLastPage).toBe(true)
    const subscriptionIds = res.body.subscriptions.map((s: { subscribedTo: { id: number } }) => s.subscribedTo.id)
    expect(subscriptionIds).toContain(player2.aliases[0].id)
    expect(subscriptionIds).toContain(player3.aliases[0].id)
  })

  it('should return both pending and confirmed subscriptions with no confirmed filter', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()

    const pendingSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .pending()
      .one()
    const confirmedSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player3.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, player3, pendingSubscription, confirmedSubscription]).flush()

    const res = await request(app)
      .get('/v1/players/relationships/subscriptions')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(2)
    expect(res.body.count).toBe(2)
    expect(res.body.isLastPage).toBe(true)
    const subscriptionIds = res.body.subscriptions.map((s: { subscribedTo: { id: number } }) => s.subscribedTo.id)
    expect(subscriptionIds).toContain(player2.aliases[0].id)
    expect(subscriptionIds).toContain(player3.aliases[0].id)
  })

  it('should not get subscriptions if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    await request(app)
      .get('/v1/players/relationships/subscriptions')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should not get subscriptions if the alias does not exist', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])

    const res = await request(app)
      .get('/v1/players/relationships/subscriptions')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '999')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should return an empty array when no subscriptions exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .get('/v1/players/relationships/subscriptions')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(0)
    expect(res.body.count).toBe(0)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should only return pending subscriptions when the confirmed filter is false', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()

    const pendingSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .pending()
      .one()
    const confirmedSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player3.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, player3, pendingSubscription, confirmedSubscription]).flush()

    const res = await request(app)
      .get('/v1/players/relationships/subscriptions?confirmed=false')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(1)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
    expect(res.body.subscriptions[0].subscribedTo.id).toBe(player2.aliases[0].id)
  })

  it('should only return confirmed subscriptions when the confirmed filter is true', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()

    const pendingSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .pending()
      .one()
    const confirmedSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player3.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, player3, pendingSubscription, confirmedSubscription]).flush()

    const res = await request(app)
      .get('/v1/players/relationships/subscriptions?confirmed=true')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(1)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
    expect(res.body.subscriptions[0].subscribedTo.id).toBe(player3.aliases[0].id)
  })

  it('should filter subscriptions by aliasId', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()

    const subscription1 = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .confirmed()
      .one()
    const subscription2 = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player3.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, player3, subscription1, subscription2]).flush()

    const res = await request(app)
      .get(`/v1/players/relationships/subscriptions?aliasId=${player2.aliases[0].id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(1)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
    expect(res.body.subscriptions[0].subscribedTo.id).toBe(player2.aliases[0].id)
  })

  it('should filter subscriptions by unidirectional relationshipType', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()

    const unidirectionalSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .unidirectional()
      .confirmed()
      .one()
    const bidirectionalSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player3.aliases[0])
      .bidirectional()
      .confirmed()
      .one()
    await em.persist([player1, player2, player3, unidirectionalSubscription, bidirectionalSubscription]).flush()

    const res = await request(app)
      .get(`/v1/players/relationships/subscriptions?relationshipType=${RelationshipType.UNIDIRECTIONAL}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(1)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
    expect(res.body.subscriptions[0].subscribedTo.id).toBe(player2.aliases[0].id)
    expect(res.body.subscriptions[0].relationshipType).toBe(RelationshipType.UNIDIRECTIONAL)
  })

  it('should filter subscriptions by bidirectional relationshipType', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()

    const unidirectionalSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .unidirectional()
      .confirmed()
      .one()
    const bidirectionalSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player3.aliases[0])
      .bidirectional()
      .confirmed()
      .one()
    await em.persist([player1, player2, player3, unidirectionalSubscription, bidirectionalSubscription]).flush()

    const res = await request(app)
      .get(`/v1/players/relationships/subscriptions?relationshipType=${RelationshipType.BIDIRECTIONAL}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(1)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
    expect(res.body.subscriptions[0].subscribedTo.id).toBe(player3.aliases[0].id)
    expect(res.body.subscriptions[0].relationshipType).toBe(RelationshipType.BIDIRECTIONAL)
  })
})
