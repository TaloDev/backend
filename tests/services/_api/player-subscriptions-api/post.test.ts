import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerAliasSubscriptionFactory from '../../../fixtures/PlayerAliasSubscriptionFactory'

describe('Player subscriptions API service - post', () => {
  it('should create a subscription if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2])

    const res = await request(app)
      .post('/v1/players/subscriptions')
      .send({ aliasId: player2.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)
    expect(res.body.subscription.subscriber.id).toBe(player1.aliases[0].id)
    expect(res.body.subscription.subscribedTo.id).toBe(player2.aliases[0].id)
    expect(res.body.subscription.confirmed).toBe(false)
  })

  it('should not create a subscription if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2])

    await request(app)
      .post('/v1/players/subscriptions')
      .send({ aliasId: player2.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(403)
  })

  it('should not create a subscription if the current alias does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/players/subscriptions')
      .send({ aliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '999')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not create a subscription if the target alias does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/players/subscriptions')
      .send({ aliasId: 999 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Player alias for subscription not found')
  })

  it('should not create a subscription if the player is trying to subscribe to themself', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/players/subscriptions')
      .send({ aliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body.message).toBe('Cannot subscribe to yourself')
  })

  it('should not create a subscription if one already exists for the same alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2])

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .one()
    await em.persistAndFlush(subscription)

    const res = await request(app)
      .post('/v1/players/subscriptions')
      .send({ aliasId: player2.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(400)

    expect(res.body.message).toBe('Subscription already exists')
  })

  it('should not create a subscription if the aliasId is not a number', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/players/subscriptions')
      .send({ aliasId: 'not-a-number' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body.message).toBe('aliasId must be a number')
  })

  it('should not create a subscription for a player from a different game', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const [apiKey2] = await createAPIKeyAndToken([])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey2.game]).one()
    await em.persistAndFlush([player1, player2])

    const res = await request(app)
      .post('/v1/players/subscriptions')
      .send({ aliasId: player2.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Player alias for subscription not found')
  })
})
