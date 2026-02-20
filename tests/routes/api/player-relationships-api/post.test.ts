import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerAliasSubscriptionFactory from '../../../fixtures/PlayerAliasSubscriptionFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import createSocketIdentifyMessage, {
  persistTestSocketTicket,
} from '../../../utils/createSocketIdentifyMessage'
import createTestSocket, { createTestClient } from '../../../utils/createTestSocket'

describe('Player relationships API - post', () => {
  it('should create a subscription if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persist([player1, player2]).flush()

    const res = await request(app)
      .post('/v1/players/relationships')
      .send({ aliasId: player2.aliases[0].id, relationshipType: 'unidirectional' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(200)

    expect(res.body.subscription.subscriber.id).toBe(player1.aliases[0].id)
    expect(res.body.subscription.subscribedTo.id).toBe(player2.aliases[0].id)
    expect(res.body.subscription.confirmed).toBe(false)
    expect(res.body.subscription.relationshipType).toBe('unidirectional')
  })

  it('should not create a subscription if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([player1, player2])

    await request(app)
      .post('/v1/players/relationships')
      .send({ aliasId: player2.aliases[0].id, relationshipType: 'unidirectional' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(403)
  })

  it('should not create a subscription if the current alias does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .post('/v1/players/relationships')
      .send({ aliasId: player.aliases[0].id, relationshipType: 'unidirectional' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '999')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not create a subscription if the target alias does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .post('/v1/players/relationships')
      .send({ aliasId: 999, relationshipType: 'unidirectional' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Player alias for subscription not found')
  })

  it('should not create a subscription if the player is trying to subscribe to themself', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .post('/v1/players/relationships')
      .send({ aliasId: player.aliases[0].id, relationshipType: 'unidirectional' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body.message).toBe('Cannot subscribe to yourself')
  })

  it('should not create a subscription if one already exists for the same alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    const subscription = await new PlayerAliasSubscriptionFactory()
      .withSubscriber(player1.aliases[0])
      .withSubscribedTo(player2.aliases[0])
      .one()
    await em.persist([player1, player2, subscription]).flush()

    const res = await request(app)
      .post('/v1/players/relationships')
      .send({ aliasId: player2.aliases[0].id, relationshipType: 'unidirectional' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(400)

    expect(res.body.message).toBe('Subscription already exists')
  })

  it('should not create a subscription for a player from a different game', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const [apiKey2] = await createAPIKeyAndToken([])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey2.game]).one()
    await em.persist([player1, player2]).flush()

    const res = await request(app)
      .post('/v1/players/relationships')
      .send({ aliasId: player2.aliases[0].id, relationshipType: 'unidirectional' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(404)

    expect(res.body.message).toBe('Player alias for subscription not found')
  })

  it('should not create a subscription if the relationshipType is invalid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persist([player1, player2]).flush()

    const res = await request(app)
      .post('/v1/players/relationships')
      .send({ aliasId: player2.aliases[0].id, relationshipType: 'invalid-type' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player1.aliases[0].id))
      .expect(400)

    expect(res.body.errors.relationshipType).toStrictEqual([
      'relationshipType must be either "unidirectional" or "bidirectional"',
    ])
  })

  it('should notify the target player when a subscription is created', async () => {
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

    await createTestSocket(`/?ticket=${ticket1}`, async (client1, _wss, port) => {
      const client2 = await createTestClient(port, `/?ticket=${ticket2}`, { waitForReady: false })

      await client1.identify(identifyMessage1)
      await client2.identify(identifyMessage2)

      await request(app)
        .post('/v1/players/relationships')
        .send({ aliasId: player2.aliases[0].id, relationshipType: 'unidirectional' })
        .auth(token1, { type: 'bearer' })
        .set('x-talo-alias', String(player1.aliases[0].id))
        .expect(200)

      await client2.expectJson((actual) => {
        expect(actual.res).toBe('v1.player-relationships.subscription-created')
        expect(actual.data.subscription.subscriber.id).toBe(player1.aliases[0].id)
        expect(actual.data.subscription.subscribedTo.id).toBe(player2.aliases[0].id)
        expect(actual.data.subscription.confirmed).toBe(false)
        expect(actual.data.subscription.relationshipType).toBe('unidirectional')
      })
    })
  })
})
