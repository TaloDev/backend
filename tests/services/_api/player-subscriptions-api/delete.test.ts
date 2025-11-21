import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerAliasSubscriptionFactory from '../../../fixtures/PlayerAliasSubscriptionFactory'
import PlayerAliasSubscription from '../../../../src/entities/player-alias-subscription'

describe('Player subscriptions API service - delete', () => {
  it('should delete a subscription', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2])

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .confirmed()
      .one()
    await em.persistAndFlush(subscription)

    await request(app)
      .delete(`/v1/players/subscriptions/${subscription.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(204)

    em.clear()
    const deletedSubscription = await em.repo(PlayerAliasSubscription).findOne(subscription.id)
    expect(deletedSubscription).toBeNull()
  })

  it('should delete a pending subscription', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2])

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .pending()
      .one()
    await em.persistAndFlush(subscription)

    await request(app)
      .delete(`/v1/players/subscriptions/${subscription.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(204)

    em.clear()
    const deletedSubscription = await em.repo(PlayerAliasSubscription).findOne(subscription.id)
    expect(deletedSubscription).toBeNull()
  })

  it('should not delete a subscription if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2])

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .confirmed()
      .one()
    await em.persistAndFlush(subscription)

    await request(app)
      .delete(`/v1/players/subscriptions/${subscription.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(403)
  })

  it('should not delete a subscription if the alias does not exist', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])

    const res = await request(app)
      .delete('/v1/players/subscriptions/some-id')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '999')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not delete a subscription that does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .delete('/v1/players/subscriptions/non-existent-id')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Subscription not found')
  })

  it('should not delete another player\'s subscription', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_SUBSCRIPTIONS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const player3 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2, player3])

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .confirmed()
      .one()
    await em.persistAndFlush(subscription)

    const res = await request(app)
      .delete(`/v1/players/subscriptions/${subscription.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player3.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Subscription not found')

    const updatedSubscription = await em.repo(PlayerAliasSubscription).findOne(subscription.id, { refresh: true })
    expect(updatedSubscription).not.toBeNull()
  })
})
