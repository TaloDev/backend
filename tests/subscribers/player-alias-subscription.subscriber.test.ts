import request from 'supertest'
import { APIKeyScope } from '../../src/entities/api-key'
import PlayerFactory from '../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'
import { RelationshipType } from '../../src/entities/player-alias-subscription'

describe('PlayerAliasSubscription subscriber', () => {
  describe('cache invalidation on create', () => {
    it('should invalidate both subscribers and subscriptions cache when a unidirectional subscription is created', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS, APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
      const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)
      await em.persistAndFlush([player1, player2])

      const alias1 = player1.aliases[0]
      const alias2 = player2.aliases[0]

      // populate cache for player1's subscriptions (should be empty)
      const res1 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias1.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.subscriptions).toHaveLength(0)

      // populate cache for player2's subscribers (should be empty)
      const res2 = await request(app)
        .get('/v1/players/relationships/subscribers')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.subscriptions).toHaveLength(0)

      // player1 subscribes to player2
      await request(app)
        .post('/v1/players/relationships')
        .send({ aliasId: alias2.id, relationshipType: RelationshipType.UNIDIRECTIONAL })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(alias1.id))
        .expect(200)

      // player1's subscriptions should now show the new subscription (cache invalidated)
      const res3 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias1.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res3.body.subscriptions).toHaveLength(1)
      expect(res3.body.subscriptions[0].subscribedTo.id).toBe(alias2.id)

      // player2's subscribers should now show player1 (cache invalidated)
      const res4 = await request(app)
        .get('/v1/players/relationships/subscribers')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res4.body.subscriptions).toHaveLength(1)
      expect(res4.body.subscriptions[0].subscriber.id).toBe(alias1.id)
    })

    it('should invalidate cache with query parameters', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS, APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
      const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)
      await em.persistAndFlush([player1, player2])

      const alias1 = player1.aliases[0]
      const alias2 = player2.aliases[0]

      // populate cache with confirmed=false filter
      const res1 = await request(app)
        .get('/v1/players/relationships/subscribers?confirmed=false')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.subscriptions).toHaveLength(0)

      // create unconfirmed subscription
      await request(app)
        .post('/v1/players/relationships')
        .send({ aliasId: alias2.id, relationshipType: RelationshipType.UNIDIRECTIONAL })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(alias1.id))
        .expect(200)

      // cache with query params should be invalidated
      const res2 = await request(app)
        .get('/v1/players/relationships/subscribers?confirmed=false')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.subscriptions).toHaveLength(1)
    })
  })

  describe('cache invalidation on update', () => {
    it('should invalidate cache when confirming a unidirectional subscription', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS, APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
      const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)
      await em.persistAndFlush([player1, player2])

      const alias1 = player1.aliases[0]
      const alias2 = player2.aliases[0]

      // create pending subscription
      const createRes = await request(app)
        .post('/v1/players/relationships')
        .send({ aliasId: alias2.id, relationshipType: RelationshipType.UNIDIRECTIONAL })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(alias1.id))
        .expect(200)

      const subscriptionId = createRes.body.subscription.id

      // populate cache with confirmed=false filter
      const res1 = await request(app)
        .get('/v1/players/relationships/subscribers?confirmed=false')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.subscriptions).toHaveLength(1)

      // populate cache with confirmed=true filter
      const res2 = await request(app)
        .get('/v1/players/relationships/subscribers?confirmed=true')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.subscriptions).toHaveLength(0)

      // confirm the subscription
      await request(app)
        .put(`/v1/players/relationships/${subscriptionId}/confirm`)
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(alias2.id))
        .expect(200)

      // confirmed=false cache should be invalidated (now empty)
      const res3 = await request(app)
        .get('/v1/players/relationships/subscribers?confirmed=false')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res3.body.subscriptions).toHaveLength(0)

      // confirmed=true cache should be invalidated (now has 1)
      const res4 = await request(app)
        .get('/v1/players/relationships/subscribers?confirmed=true')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res4.body.subscriptions).toHaveLength(1)
      expect(res4.body.subscriptions[0].confirmed).toBe(true)
    })

    it('should invalidate all 4 cache keys when confirming a bidirectional subscription', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS, APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
      const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)
      await em.persistAndFlush([player1, player2])

      const alias1 = player1.aliases[0]
      const alias2 = player2.aliases[0]

      // create pending bidirectional subscription
      const createRes = await request(app)
        .post('/v1/players/relationships')
        .send({ aliasId: alias2.id, relationshipType: RelationshipType.BIDIRECTIONAL })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(alias1.id))
        .expect(200)

      const subscriptionId = createRes.body.subscription.id

      // populate all 4 cache combinations
      // player1's subscriptions
      const res1 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias1.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.subscriptions).toHaveLength(1)
      expect(res1.body.subscriptions[0].confirmed).toBe(false)

      // player2's subscribers
      const res2 = await request(app)
        .get('/v1/players/relationships/subscribers')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.subscriptions).toHaveLength(1)
      expect(res2.body.subscriptions[0].confirmed).toBe(false)

      // player2's subscriptions (should be empty before confirm)
      const res3 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res3.body.subscriptions).toHaveLength(0)

      // player1's subscribers (should be empty before confirm)
      const res4 = await request(app)
        .get('/v1/players/relationships/subscribers')
        .set('x-talo-alias', String(alias1.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res4.body.subscriptions).toHaveLength(0)

      // confirm the subscription (creates reciprocal subscription)
      await request(app)
        .put(`/v1/players/relationships/${subscriptionId}/confirm`)
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(alias2.id))
        .expect(200)

      // all 4 caches should be invalidated
      // player1's subscriptions (should now be confirmed)
      const res5 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias1.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res5.body.subscriptions).toHaveLength(1)
      expect(res5.body.subscriptions[0].confirmed).toBe(true)

      // player2's subscribers (should now be confirmed)
      const res6 = await request(app)
        .get('/v1/players/relationships/subscribers')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res6.body.subscriptions).toHaveLength(1)
      expect(res6.body.subscriptions[0].confirmed).toBe(true)

      // player2's subscriptions (should now have reciprocal)
      const res7 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res7.body.subscriptions).toHaveLength(1)
      expect(res7.body.subscriptions[0].confirmed).toBe(true)
      expect(res7.body.subscriptions[0].subscribedTo.id).toBe(alias1.id)

      // player1's subscribers (should now have reciprocal)
      const res8 = await request(app)
        .get('/v1/players/relationships/subscribers')
        .set('x-talo-alias', String(alias1.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res8.body.subscriptions).toHaveLength(1)
      expect(res8.body.subscriptions[0].confirmed).toBe(true)
      expect(res8.body.subscriptions[0].subscriber.id).toBe(alias2.id)
    })
  })

  describe('cache invalidation on delete', () => {
    it('should invalidate cache when deleting a unidirectional subscription', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS, APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
      const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)
      await em.persistAndFlush([player1, player2])

      const alias1 = player1.aliases[0]
      const alias2 = player2.aliases[0]

      // create and confirm subscription
      const createRes = await request(app)
        .post('/v1/players/relationships')
        .send({ aliasId: alias2.id, relationshipType: RelationshipType.UNIDIRECTIONAL })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(alias1.id))
        .expect(200)

      const subscriptionId = createRes.body.subscription.id

      // populate cache with the subscription
      const res1 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias1.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.subscriptions).toHaveLength(1)

      const res2 = await request(app)
        .get('/v1/players/relationships/subscribers')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.subscriptions).toHaveLength(1)

      // delete the subscription
      await request(app)
        .delete(`/v1/players/relationships/${subscriptionId}`)
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(alias1.id))
        .expect(204)

      // both caches should be invalidated
      const res3 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias1.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res3.body.subscriptions).toHaveLength(0)

      const res4 = await request(app)
        .get('/v1/players/relationships/subscribers')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res4.body.subscriptions).toHaveLength(0)
    })

    it('should invalidate all 4 cache keys when deleting a bidirectional subscription', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS, APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
      const [player1, player2] = await new PlayerFactory([apiKey.game]).many(2)
      await em.persistAndFlush([player1, player2])

      const alias1 = player1.aliases[0]
      const alias2 = player2.aliases[0]

      // create and confirm bidirectional subscription
      const createRes = await request(app)
        .post('/v1/players/relationships')
        .send({ aliasId: alias2.id, relationshipType: RelationshipType.BIDIRECTIONAL })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(alias1.id))
        .expect(200)

      const subscriptionId = createRes.body.subscription.id

      await request(app)
        .put(`/v1/players/relationships/${subscriptionId}/confirm`)
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(alias2.id))
        .expect(200)

      // populate all 4 caches
      const res1 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias1.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      const res2 = await request(app)
        .get('/v1/players/relationships/subscribers')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      const res3 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      const res4 = await request(app)
        .get('/v1/players/relationships/subscribers')
        .set('x-talo-alias', String(alias1.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.subscriptions).toHaveLength(1)
      expect(res2.body.subscriptions).toHaveLength(1)
      expect(res3.body.subscriptions).toHaveLength(1)
      expect(res4.body.subscriptions).toHaveLength(1)

      // delete the subscription (should delete both)
      await request(app)
        .delete(`/v1/players/relationships/${subscriptionId}`)
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(alias1.id))
        .expect(204)

      // all 4 caches should be invalidated
      const res5 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias1.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      const res6 = await request(app)
        .get('/v1/players/relationships/subscribers')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      const res7 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      const res8 = await request(app)
        .get('/v1/players/relationships/subscribers')
        .set('x-talo-alias', String(alias1.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res5.body.subscriptions).toHaveLength(0)
      expect(res6.body.subscriptions).toHaveLength(0)
      expect(res7.body.subscriptions).toHaveLength(0)
      expect(res8.body.subscriptions).toHaveLength(0)
    })
  })

  describe('cache isolation by player', () => {
    it('should only invalidate cache for affected players', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_RELATIONSHIPS, APIKeyScope.WRITE_PLAYER_RELATIONSHIPS])
      const [player1, player2, player3] = await new PlayerFactory([apiKey.game]).many(3)
      await em.persistAndFlush([player1, player2, player3])

      const alias1 = player1.aliases[0]
      const alias2 = player2.aliases[0]
      const alias3 = player3.aliases[0]

      // populate cache for all 3 players
      const res1 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias1.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      const res2 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      const res3 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias3.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.subscriptions).toHaveLength(0)
      expect(res2.body.subscriptions).toHaveLength(0)
      expect(res3.body.subscriptions).toHaveLength(0)

      // player1 subscribes to player2
      await request(app)
        .post('/v1/players/relationships')
        .send({ aliasId: alias2.id, relationshipType: RelationshipType.UNIDIRECTIONAL })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(alias1.id))
        .expect(200)

      // player1 and player2 caches should be invalidated
      const res4 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias1.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      const res5 = await request(app)
        .get('/v1/players/relationships/subscribers')
        .set('x-talo-alias', String(alias2.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res4.body.subscriptions).toHaveLength(1)
      expect(res5.body.subscriptions).toHaveLength(1)

      // player3 cache should still be empty (not affected)
      const res6 = await request(app)
        .get('/v1/players/relationships/subscriptions')
        .set('x-talo-alias', String(alias3.id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res6.body.subscriptions).toHaveLength(0)
    })
  })
})
