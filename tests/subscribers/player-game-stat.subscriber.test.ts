import request from 'supertest'
import { APIKeyScope } from '../../src/entities/api-key'
import PlayerFactory from '../fixtures/PlayerFactory'
import GameStatFactory from '../fixtures/GameStatFactory'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'

describe('PlayerGameStat subscriber', () => {
  describe('cache invalidation on create', () => {
    it('should invalidate the player stat cache when a new stat is created', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS, APIKeyScope.WRITE_GAME_STATS])
      const stat = await new GameStatFactory([apiKey.game]).state(() => ({ maxValue: 999, maxChange: 99, defaultValue: 0 })).one()
      const player = await new PlayerFactory([apiKey.game]).one()
      await em.persistAndFlush([stat, player])

      // this will populate the cache (null value)
      const res1 = await request(app)
        .get(`/v1/game-stats/${stat.internalName}/player-stat`)
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.playerStat).toBeNull()

      // create a stat - this should clear the cache
      await request(app)
        .put(`/v1/game-stats/${stat.internalName}`)
        .send({ change: 50 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // should return the new stat (not cached null)
      const res2 = await request(app)
        .get(`/v1/game-stats/${stat.internalName}/player-stat`)
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.playerStat).not.toBeNull()
      expect(res2.body.playerStat.value).toBe(50)
    })

    it('should invalidate the player stats list cache when a new stat is created', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS, APIKeyScope.WRITE_GAME_STATS])
      const stats = await new GameStatFactory([apiKey.game]).state(() => ({ maxValue: 999, maxChange: 99, defaultValue: 0 })).many(2)
      const player = await new PlayerFactory([apiKey.game]).one()
      await em.persistAndFlush([...stats, player])

      // populate the cache with empty list
      const res1 = await request(app)
        .get('/v1/game-stats/player-stats')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.playerStats).toHaveLength(0)

      // create the first stat
      await request(app)
        .put(`/v1/game-stats/${stats[0].internalName}`)
        .send({ change: 10 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // should show 1 stat
      const res2 = await request(app)
        .get('/v1/game-stats/player-stats')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.playerStats).toHaveLength(1)

      // create the second stat
      await request(app)
        .put(`/v1/game-stats/${stats[1].internalName}`)
        .send({ change: 20 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // should show 2 stats
      const res3 = await request(app)
        .get('/v1/game-stats/player-stats')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res3.body.playerStats).toHaveLength(2)
    })
  })

  describe('cache invalidation on update', () => {
    it('should invalidate the player stat cache when a stat is updated', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS, APIKeyScope.WRITE_GAME_STATS])
      const stat = await new GameStatFactory([apiKey.game]).state(() => ({ maxValue: 999, maxChange: 99, defaultValue: 0, minTimeBetweenUpdates: 0 })).one()
      const player = await new PlayerFactory([apiKey.game]).one()
      await em.persistAndFlush([stat, player])

      // create the initial stat
      await request(app)
        .put(`/v1/game-stats/${stat.internalName}`)
        .send({ change: 25 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // populate cache with value 25
      const res1 = await request(app)
        .get(`/v1/game-stats/${stat.internalName}/player-stat`)
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.playerStat.value).toBe(25)

      // update the stat
      await request(app)
        .put(`/v1/game-stats/${stat.internalName}`)
        .send({ change: 30 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // should return the updated value (not cached 25)
      const res2 = await request(app)
        .get(`/v1/game-stats/${stat.internalName}/player-stat`)
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.playerStat.value).toBe(55)
    })

    it('should invalidate the player stats list cache when a stat is updated', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS, APIKeyScope.WRITE_GAME_STATS])
      const stat = await new GameStatFactory([apiKey.game]).state(() => ({ maxValue: 999, maxChange: 99, defaultValue: 0, minTimeBetweenUpdates: 0 })).one()
      const player = await new PlayerFactory([apiKey.game]).one()
      await em.persistAndFlush([stat, player])

      // create the initial stat
      await request(app)
        .put(`/v1/game-stats/${stat.internalName}`)
        .send({ change: 40 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // populate the cache
      const res1 = await request(app)
        .get('/v1/game-stats/player-stats')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.playerStats).toHaveLength(1)
      expect(res1.body.playerStats[0].value).toBe(40)

      // update the stat
      await request(app)
        .put(`/v1/game-stats/${stat.internalName}`)
        .send({ change: 15 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // should return the updated value
      const res2 = await request(app)
        .get('/v1/game-stats/player-stats')
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.playerStats).toHaveLength(1)
      expect(res2.body.playerStats[0].value).toBe(55)
    })

    it('should handle multiple updates correctly', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS, APIKeyScope.WRITE_GAME_STATS])
      const stat = await new GameStatFactory([apiKey.game]).state(() => ({
        maxValue: 999,
        maxChange: 99,
        defaultValue: 0,
        minTimeBetweenUpdates: 0
      })).one()
      const player = await new PlayerFactory([apiKey.game]).one()
      await em.persistAndFlush([stat, player])

      // create the initial stat
      await request(app)
        .put(`/v1/game-stats/${stat.internalName}`)
        .send({ change: 10 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // cache with value 10
      const res1 = await request(app)
        .get(`/v1/game-stats/${stat.internalName}/player-stat`)
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1.body.playerStat.value).toBe(10)

      await request(app)
        .put(`/v1/game-stats/${stat.internalName}`)
        .send({ change: 20 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      await request(app)
        .put(`/v1/game-stats/${stat.internalName}`)
        .send({ change: 30 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)

      // should return the final value
      const res2 = await request(app)
        .get(`/v1/game-stats/${stat.internalName}/player-stat`)
        .set('x-talo-alias', String(player.aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2.body.playerStat.value).toBe(60)
    })
  })

  describe('cache invalidation for specific player', () => {
    it('should only invalidate cache for the affected player', async () => {
      const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS, APIKeyScope.WRITE_GAME_STATS])
      const stat = await new GameStatFactory([apiKey.game]).state(() => ({ maxValue: 999, maxChange: 150, defaultValue: 0, minTimeBetweenUpdates: 0 })).one()
      const players = await new PlayerFactory([apiKey.game]).many(2)
      await em.persistAndFlush([stat, ...players])

      // create a stat for the first player
      await request(app)
        .put(`/v1/game-stats/${stat.internalName}`)
        .send({ change: 100 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(players[0].aliases[0].id))
        .expect(200)

      // cache both
      const res1Player1 = await request(app)
        .get(`/v1/game-stats/${stat.internalName}/player-stat`)
        .set('x-talo-alias', String(players[0].aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      const res1Player2 = await request(app)
        .get(`/v1/game-stats/${stat.internalName}/player-stat`)
        .set('x-talo-alias', String(players[1].aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res1Player1.body.playerStat.value).toBe(100)
      expect(res1Player2.body.playerStat).toBeNull()

      // update the first player's stat
      await request(app)
        .put(`/v1/game-stats/${stat.internalName}`)
        .send({ change: 50 })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(players[0].aliases[0].id))
        .expect(200)

      // verify the first player's cache was invalidated
      const res2Player1 = await request(app)
        .get(`/v1/game-stats/${stat.internalName}/player-stat`)
        .set('x-talo-alias', String(players[0].aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2Player1.body.playerStat.value).toBe(150)

      // second player's stat should still be null
      const res2Player2 = await request(app)
        .get(`/v1/game-stats/${stat.internalName}/player-stat`)
        .set('x-talo-alias', String(players[1].aliases[0].id))
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res2Player2.body.playerStat).toBeNull()
    })
  })
})
