import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key.js'
import PlayerAliasSubscriptionFactory from '../../../fixtures/PlayerAliasSubscriptionFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken.js'

describe('Player relationship API - update', () => {
  it('should add, overwrite and delete props', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .withProps([
        { key: 'nickname', value: 'bestie' },
        { key: 'favourite', value: 'true' },
      ])
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    const res = await request(app)
      .patch(`/v1/players/relationships/${subscription.id}`)
      .send({
        props: [
          { key: 'nickname', value: 'arch nemesis' },
          { key: 'favourite', value: null },
          { key: 'level', value: '5' },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscription.props).toEqual(
      expect.arrayContaining([
        { key: 'nickname', value: 'arch nemesis' },
        { key: 'level', value: '5' },
      ]),
    )
    expect(res.body.subscription.props).toHaveLength(2)

    await em.refreshOrFail(subscription, { populate: ['props'] })
    expect(
      subscription.props.getItems().map((prop) => ({ key: prop.key, value: prop.value })),
    ).toEqual(
      expect.arrayContaining([
        { key: 'nickname', value: 'arch nemesis' },
        { key: 'level', value: '5' },
      ]),
    )
  })

  it('should leave props alone if none are provided', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .withProps([{ key: 'nickname', value: 'bestie' }])
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    const res = await request(app)
      .patch(`/v1/players/relationships/${subscription.id}`)
      .send({})
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscription.props).toEqual([{ key: 'nickname', value: 'bestie' }])

    await em.refreshOrFail(subscription, { populate: ['props'] })
    expect(subscription.props.getItems().map((prop) => prop.value)).toEqual(['bestie'])
  })

  it('should support prop arrays', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    const res = await request(app)
      .patch(`/v1/players/relationships/${subscription.id}`)
      .send({
        props: [
          { key: 'tags[]', value: 'co-op' },
          { key: 'tags[]', value: 'night owl' },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscription.props).toEqual(
      expect.arrayContaining([
        { key: 'tags[]', value: 'co-op' },
        { key: 'tags[]', value: 'night owl' },
      ]),
    )
  })

  it('should not update props if any prop is invalid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .withProps([{ key: 'nickname', value: 'bestie' }])
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    const res = await request(app)
      .patch(`/v1/players/relationships/${subscription.id}`)
      .send({
        props: [
          { key: 'nickname', value: 'arch nemesis' },
          { key: 'tooLong', value: 'a'.repeat(513) },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(400)

    expect(res.body.errors).toEqual({ props: ['One or more props are invalid, see rejectedProps'] })
    expect(res.body.rejectedProps).toEqual([
      {
        key: 'tooLong',
        error: 'PROP_VALUE_TOO_LONG',
        message: 'Prop value length (513) exceeds 512 characters',
      },
    ])

    await em.refreshOrFail(subscription, { populate: ['props'] })
    expect(subscription.props.getItems().map((prop) => prop.value)).toEqual(['bestie'])
  })

  it('should reject profane props when blockPropsProfanity is enabled', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    apiKey.game.blockPropsProfanity = true
    await em.flush()

    const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)
    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .withProps([{ key: 'nickname', value: 'bestie' }])
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    const res = await request(app)
      .patch(`/v1/players/relationships/${subscription.id}`)
      .send({
        props: [
          { key: 'nickname', value: 'fuck' },
          { key: 'level', value: '5' },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(400)

    expect(res.body.rejectedProps).toEqual([
      {
        key: 'nickname',
        error: 'PROP_CONTAINS_PROFANITY',
        message: 'Prop value contains profanity',
      },
    ])

    await em.refreshOrFail(subscription, { populate: ['props'] })
    expect(subscription.props.getItems().map((prop) => prop.value)).toEqual(['bestie'])
  })

  it('should allow profane props when blockPropsProfanity is disabled', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    const res = await request(app)
      .patch(`/v1/players/relationships/${subscription.id}`)
      .send({ props: [{ key: 'nickname', value: 'fuck' }] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscription.props).toEqual([{ key: 'nickname', value: 'fuck' }])
  })

  it('should not update props if the scope is missing', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    await request(app)
      .patch(`/v1/players/relationships/${subscription.id}`)
      .send({ props: [{ key: 'nickname', value: 'bestie' }] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(403)

    await em.refreshOrFail(subscription, { populate: ['props'] })
    expect(subscription.props.getItems()).toHaveLength(0)
  })

  it('should not update props on another player subscription', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const [player1, player2, player3] = await new PlayerFactory([apiKey.game]).many(3)

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .withProps([{ key: 'nickname', value: 'bestie' }])
      .confirmed()
      .one()
    await em.persist([player1, player2, player3, subscription]).flush()

    const res = await request(app)
      .patch(`/v1/players/relationships/${subscription.id}`)
      .send({ props: [{ key: 'nickname', value: 'hacked' }] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player3.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Subscription not found')

    await em.refreshOrFail(subscription, { populate: ['props'] })
    expect(subscription.props.getItems().map((prop) => prop.value)).toEqual(['bestie'])
  })

  it('should not update props from the subscribed to side', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .withProps([{ key: 'nickname', value: 'bestie' }])
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    const res = await request(app)
      .patch(`/v1/players/relationships/${subscription.id}`)
      .send({ props: [{ key: 'nickname', value: 'hacked' }] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player2.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Subscription not found')

    await em.refreshOrFail(subscription, { populate: ['props'] })
    expect(subscription.props.getItems().map((prop) => prop.value)).toEqual(['bestie'])
  })

  it('should not update props on a subscription that does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch('/v1/players/relationships/999999')
      .send({ props: [{ key: 'nickname', value: 'bestie' }] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Subscription not found')
  })

  it('should not write any props if the update fails', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .withProps([{ key: 'nickname', value: 'bestie' }])
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    vi.spyOn(EntityManager.prototype, 'transactional').mockRejectedValueOnce(
      new Error('transaction failure'),
    )

    await request(app)
      .patch(`/v1/players/relationships/${subscription.id}`)
      .send({ props: [{ key: 'nickname', value: 'hacked' }] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(500)

    await em.refreshOrFail(subscription, { populate: ['props'] })
    expect(subscription.props.getItems().map((prop) => prop.value)).toEqual(['bestie'])
  })

  it('should invalidate the response cache when props change', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYER_RELATIONSHIPS,
      APIKeyScope.WRITE_PLAYER_RELATIONSHIPS,
    ])
    const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .withProps([{ key: 'nickname', value: 'bestie' }])
      .confirmed()
      .one()
    await em.persist([player1, player2, subscription]).flush()

    // populate the cache for both sides of the relationship
    const cached = await request(app)
      .get('/v1/players/relationships/subscribers')
      .set('x-talo-alias', String(player2.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(cached.body.subscriptions[0].props).toEqual([{ key: 'nickname', value: 'bestie' }])

    await request(app)
      .patch(`/v1/players/relationships/${subscription.id}`)
      .send({ props: [{ key: 'nickname', value: 'arch nemesis' }] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    const res = await request(app)
      .get('/v1/players/relationships/subscribers')
      .set('x-talo-alias', String(player2.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.subscriptions[0].props).toEqual([{ key: 'nickname', value: 'arch nemesis' }])
  })
})
