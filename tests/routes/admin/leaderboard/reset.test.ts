import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import LeaderboardEntry from '../../../../src/entities/leaderboard-entry.js'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory.js'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Leaderboard admin API - reset entries', () => {
  it('should reset all entries for a key with the write:leaderboards scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    const players = await new PlayerFactory([apiKey.game]).many(3)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(3)
    await em.persist(entries).flush()

    const res = await request(app)
      .delete(`/admin/v1/leaderboards/${leaderboard.id}/entries`)
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(3)

    const remainingEntries = await em.repo(LeaderboardEntry).find({ leaderboard })
    expect(remainingEntries).toHaveLength(0)
  })

  it('should return 404 for a non-existent leaderboard', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])

    const res = await request(app)
      .delete('/admin/v1/leaderboards/21312312/entries')
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body.message).toBe('Leaderboard not found')
  })

  it('should return 400 for an invalid mode', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await em.persist(leaderboard).flush()

    const res = await request(app)
      .delete(`/admin/v1/leaderboards/${leaderboard.id}/entries`)
      .query({ mode: 'invalid' })
      .auth(keyString, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        mode: ['Mode must be one of: all, live, dev'],
      },
    })
  })

  it('should return 403 for a key missing the write:leaderboards scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    const players = await new PlayerFactory([apiKey.game]).many(2)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(2)
    await em.persist(entries).flush()

    const res = await request(app)
      .delete(`/admin/v1/leaderboards/${leaderboard.id}/entries`)
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:leaderboards')

    const remainingEntries = await em.repo(LeaderboardEntry).find({ leaderboard })
    expect(remainingEntries).toHaveLength(2)
  })

  it('should return 404 for a leaderboard in another game', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])
    const { apiKey: otherKey } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([otherKey.game]).one()
    const players = await new PlayerFactory([otherKey.game]).many(2)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(2)
    await em.persist(entries).flush()

    const res = await request(app)
      .delete(`/admin/v1/leaderboards/${leaderboard.id}/entries`)
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body.message).toBe('Leaderboard not found')

    const remainingEntries = await em.repo(LeaderboardEntry).find({ leaderboard })
    expect(remainingEntries).toHaveLength(2)
  })
})
