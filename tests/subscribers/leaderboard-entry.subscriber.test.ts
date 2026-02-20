import request from 'supertest'
import { APIKeyScope } from '../../src/entities/api-key'
import { LeaderboardSortMode } from '../../src/entities/leaderboard'
import LeaderboardFactory from '../fixtures/LeaderboardFactory'
import PlayerFactory from '../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'

describe('LeaderboardEntry subscriber', () => {
  describe('cache invalidation on create', () => {
    it('should invalidate the leaderboard entries cache when a new entry is created', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([
        APIKeyScope.READ_LEADERBOARDS,
        APIKeyScope.WRITE_LEADERBOARDS,
      ])
      const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
      const player = await new PlayerFactory([apiKey.game]).one()
      await em.persistAndFlush([leaderboard, player])

      // this will populate the cache
      const res1 = await request(app)
        .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .query({ page: 0 })
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.entries).toHaveLength(0)

      // create an entry - this should clear the cache
      await request(app)
        .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .send({ score: 300 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // should return the new entry (not cached empty result)
      const res2 = await request(app)
        .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .query({ page: 0 })
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.entries).toHaveLength(1)
      expect(res2.body.entries[0].score).toBe(300)
    })

    it('should invalidate the cache for multiple entries on the same leaderboard', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([
        APIKeyScope.READ_LEADERBOARDS,
        APIKeyScope.WRITE_LEADERBOARDS,
      ])
      const leaderboard = await new LeaderboardFactory([apiKey.game])
        .state(() => ({ unique: false }))
        .one()
      const players = await new PlayerFactory([apiKey.game]).many(2)
      await em.persistAndFlush([leaderboard, ...players])

      // populate the cache with empty result
      const res1 = await request(app)
        .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .query({ page: 0 })
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.entries).toHaveLength(0)

      // create the first entry
      await request(app)
        .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .send({ score: 100 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(players[0].aliases[0].id))
        .expect(200)

      // should show 1 entry
      const res2 = await request(app)
        .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .query({ page: 0 })
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.entries).toHaveLength(1)

      // create the second entry
      await request(app)
        .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .send({ score: 200 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(players[1].aliases[0].id))
        .expect(200)

      // should show 2 entries
      const res3 = await request(app)
        .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .query({ page: 0 })
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res3.body.entries).toHaveLength(2)
    })
  })

  describe('cache invalidation on update', () => {
    it('should invalidate the leaderboard entries cache when an entry is updated', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([
        APIKeyScope.READ_LEADERBOARDS,
        APIKeyScope.WRITE_LEADERBOARDS,
      ])
      const leaderboard = await new LeaderboardFactory([apiKey.game])
        .state(() => ({
          unique: true,
          sortMode: LeaderboardSortMode.DESC,
        }))
        .one()
      const player = await new PlayerFactory([apiKey.game]).one()
      await em.persistAndFlush([leaderboard, player])

      // create the initial entry
      await request(app)
        .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .send({ score: 100 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // populate the cache with score 100
      const res1 = await request(app)
        .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .query({ page: 0 })
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.entries).toHaveLength(1)
      expect(res1.body.entries[0].score).toBe(100)

      // update the entry (unique leaderboard will update existing entry)
      await request(app)
        .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .send({ score: 250 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // should return the updated score (not cached 100)
      const res2 = await request(app)
        .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .query({ page: 0 })
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.entries).toHaveLength(1)
      expect(res2.body.entries[0].score).toBe(250)
    })

    it('should invalidate the cache when entry position changes', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([
        APIKeyScope.READ_LEADERBOARDS,
        APIKeyScope.WRITE_LEADERBOARDS,
      ])
      const leaderboard = await new LeaderboardFactory([apiKey.game])
        .state(() => ({
          unique: true,
          sortMode: LeaderboardSortMode.DESC,
        }))
        .one()
      const players = await new PlayerFactory([apiKey.game]).many(2)
      await em.persistAndFlush([leaderboard, ...players])

      await request(app)
        .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .send({ score: 200 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(players[0].aliases[0].id))
        .expect(200)

      await request(app)
        .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .send({ score: 100 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(players[1].aliases[0].id))
        .expect(200)

      // first player should be in position 0
      const res1 = await request(app)
        .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .query({ page: 0 })
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.entries[0].score).toBe(200)
      expect(res1.body.entries[0].position).toBe(0)
      expect(res1.body.entries[1].score).toBe(100)
      expect(res1.body.entries[1].position).toBe(1)

      // update the second player's score to be higher
      await request(app)
        .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .send({ score: 300 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(players[1].aliases[0].id))
        .expect(200)

      // positions should be swapped
      const res2 = await request(app)
        .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
        .query({ page: 0 })
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.entries[0].score).toBe(300)
      expect(res2.body.entries[0].position).toBe(0)
      expect(res2.body.entries[1].score).toBe(200)
      expect(res2.body.entries[1].position).toBe(1)
    })
  })
})
