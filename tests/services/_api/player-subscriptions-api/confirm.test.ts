import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerAliasSubscriptionFactory from '../../../fixtures/PlayerAliasSubscriptionFactory'

describe('Player subscriptions API service - confirm', () => {
  it('should confirm a pending subscription request', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2])

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .pending()
      .one()
    await em.persistAndFlush(subscription)

    const res = await request(app)
      .put(`/v1/players/subscriptions/${subscription.id}/confirm`)
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
    await em.persistAndFlush([player1, player2])

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .pending()
      .one()
    await em.persistAndFlush(subscription)

    await request(app)
      .put(`/v1/players/subscriptions/${subscription.id}/confirm`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(403)
  })

  it('should not confirm a subscription if the alias does not exist', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])

    const res = await request(app)
      .put('/v1/players/subscriptions/some-id/confirm')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '999')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not confirm a subscription that does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .put('/v1/players/subscriptions/non-existent-id/confirm')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Subscription request not found')
  })

  it('should not confirm a subscription that is not pending', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2])

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .confirmed()
      .one()
    await em.persistAndFlush(subscription)

    const res = await request(app)
      .put(`/v1/players/subscriptions/${subscription.id}/confirm`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Subscription request not found')
  })

  it('should not confirm a subscription for another player', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2, player3])

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player2.aliases[0])
      .withSubscribedTo(player1.aliases[0])
      .pending()
      .one()
    await em.persistAndFlush(subscription)

    const res = await request(app)
      .put(`/v1/players/subscriptions/${subscription.id}/confirm`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player3.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Subscription request not found')
  })
})
