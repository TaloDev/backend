import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Leaderboard admin API - entries', () => {
  it("should return a leaderboard's entries for a key with the read:leaderboards scope", async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_LEADERBOARDS])

    const players = await new PlayerFactory([apiKey.game]).many(5)
    em.persist(players)

    const leaderboard = await new LeaderboardFactory([apiKey.game]).withEntries().one()
    await em.persist(leaderboard).flush()

    const res = await request(app)
      .get(`/admin/v1/leaderboards/${leaderboard.id}/entries`)
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(leaderboard.entries.length)
    expect(res.body.count).toBe(leaderboard.entries.length)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should return 404 for a non-existent leaderboard', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_LEADERBOARDS])

    const res = await request(app)
      .get('/admin/v1/leaderboards/21312312/entries')
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body.message).toBe('Leaderboard not found')
  })

  it('should return 403 for a key missing the read:leaderboards scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_STATS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await em.persist(leaderboard).flush()

    const res = await request(app)
      .get(`/admin/v1/leaderboards/${leaderboard.id}/entries`)
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('read:leaderboards')
  })
})
