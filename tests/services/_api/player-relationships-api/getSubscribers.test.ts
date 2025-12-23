import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerAliasSubscriptionFactory from '../../../fixtures/PlayerAliasSubscriptionFactory'

describe('Player relationships API service - getSubscribers', () => {
  it('should get confirmed subscribers', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .confirmed()
      .one()
    const subscription2 = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player3.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, player3, subscription, subscription2]).flush()

    const res = await request(app)
      .get('/v1/players/relationships/subscribers')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(2)
    expect(res.body.count).toBe(2)
    expect(res.body.isLastPage).toBe(true)
    const subscriberIds = res.body.subscriptions.map((s: { subscriber: { id: number } }) => s.subscriber.id)
    expect(subscriberIds).toContain(player2.aliases[0].id)
    expect(subscriberIds).toContain(player3.aliases[0].id)
  })

  it('should return both pending and confirmed subscribers with no confirmed filter', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()

    const pendingSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .pending()
      .one()
    const confirmedSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player3.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, player3, pendingSubscription, confirmedSubscription]).flush()

    const res = await request(app)
      .get('/v1/players/relationships/subscribers')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(2)
    expect(res.body.count).toBe(2)
    expect(res.body.isLastPage).toBe(true)
    const subscriberIds = res.body.subscriptions.map((s: { subscriber: { id: number } }) => s.subscriber.id)
    expect(subscriberIds).toContain(player2.aliases[0].id)
    expect(subscriberIds).toContain(player3.aliases[0].id)
  })

  it('should not get subscribers if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .get('/v1/players/relationships/subscribers')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should not get subscribers if the alias does not exist', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])

    const res = await request(app)
      .get('/v1/players/relationships/subscribers')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '999')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should return an empty array when no subscribers exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .get('/v1/players/relationships/subscribers')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(0)
    expect(res.body.count).toBe(0)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should only return pending subscribers when the confirmed filter is false', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()

    const pendingSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .pending()
      .one()
    const confirmedSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player3.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, player3, pendingSubscription, confirmedSubscription]).flush()

    const res = await request(app)
      .get('/v1/players/relationships/subscribers?confirmed=false')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(1)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
    expect(res.body.subscriptions[0].subscriber.id).toBe(player2.aliases[0].id)
  })

  it('should only return confirmed subscribers when the confirmed filter is true', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()

    const pendingSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .pending()
      .one()
    const confirmedSubscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player3.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, player3, pendingSubscription, confirmedSubscription]).flush()

    const res = await request(app)
      .get('/v1/players/relationships/subscribers?confirmed=true')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(1)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
    expect(res.body.subscriptions[0].subscriber.id).toBe(player3.aliases[0].id)
  })

  it('should filter subscribers by aliasId', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()

    const subscription1 = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .confirmed()
      .one()
    const subscription2 = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player3.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, player3, subscription1, subscription2]).flush()

    const res = await request(app)
      .get(`/v1/players/relationships/subscribers?aliasId=${player2.aliases[0].id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(1)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
    expect(res.body.subscriptions[0].subscriber.id).toBe(player2.aliases[0].id)
  })
})
