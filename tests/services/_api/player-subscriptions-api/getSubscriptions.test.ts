import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerAliasSubscriptionFactory from '../../../fixtures/PlayerAliasSubscriptionFactory'

describe('Player subscriptions API service - getSubscriptions', () => {
  it('should get confirmed subscriptions', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_SUBSCRIPTIONS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2, player3])

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
    await em.persistAndFlush([subscription, subscription2])

    const res = await request(app)
      .get('/v1/players/subscriptions/subscriptions')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(2)
    expect(res.body.count).toBe(2)
    expect(res.body.isLastPage).toBe(true)
    const subscriptionIds = res.body.subscriptions.map((s: { id: number }) => s.id)
    expect(subscriptionIds).toContain(player2.aliases[0].id)
    expect(subscriptionIds).toContain(player3.aliases[0].id)
  })

  it('should return both pending and confirmed subscriptions with no confirmed filter', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_SUBSCRIPTIONS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2, player3])

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
    await em.persistAndFlush([pendingSubscription, confirmedSubscription])

    const res = await request(app)
      .get('/v1/players/subscriptions/subscriptions')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(2)
    expect(res.body.count).toBe(2)
    expect(res.body.isLastPage).toBe(true)
    const subscriptionIds = res.body.subscriptions.map((s: { id: number }) => s.id)
    expect(subscriptionIds).toContain(player2.aliases[0].id)
    expect(subscriptionIds).toContain(player3.aliases[0].id)
  })

  it('should not get subscriptions if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .get('/v1/players/subscriptions/subscriptions')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should not get subscriptions if the alias does not exist', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_SUBSCRIPTIONS])

    const res = await request(app)
      .get('/v1/players/subscriptions/subscriptions')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '999')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should return an empty array when no subscriptions exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_SUBSCRIPTIONS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .get('/v1/players/subscriptions/subscriptions')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(0)
    expect(res.body.count).toBe(0)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should only return pending subscriptions when confirmed filter is false', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_SUBSCRIPTIONS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2, player3])

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
    await em.persistAndFlush([pendingSubscription, confirmedSubscription])

    const res = await request(app)
      .get('/v1/players/subscriptions/subscriptions?confirmed=false')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(1)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
    expect(res.body.subscriptions[0].id).toBe(player2.aliases[0].id)
  })

  it('should only return confirmed subscriptions when confirmed filter is true', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_SUBSCRIPTIONS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2, player3])

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
    await em.persistAndFlush([pendingSubscription, confirmedSubscription])

    const res = await request(app)
      .get('/v1/players/subscriptions/subscriptions?confirmed=true')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(1)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
    expect(res.body.subscriptions[0].id).toBe(player3.aliases[0].id)
  })

  it('should filter subscriptions by aliasId', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_SUBSCRIPTIONS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2, player3])

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
    await em.persistAndFlush([subscription1, subscription2])

    const res = await request(app)
      .get(`/v1/players/subscriptions/subscriptions?aliasId=${player2.aliases[0].id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscriptions).toHaveLength(1)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
    expect(res.body.subscriptions[0].id).toBe(player2.aliases[0].id)
  })

  it('should return 400 if confirmed is invalid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_SUBSCRIPTIONS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .get('/v1/players/subscriptions/subscriptions?confirmed=INVALID')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body.message).toBe('confirmed must be either true or false')
  })

  it('should return 400 if the aliasId is not a number', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_SUBSCRIPTIONS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .get('/v1/players/subscriptions/subscriptions?aliasId=notanumber')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body.message).toBe('aliasId must be a number')
  })
})
