import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Leaderboard admin API - list', () => {
  it('should return a list of leaderboards for a key with the read:leaderboards scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_LEADERBOARDS])

    const leaderboards = await new LeaderboardFactory([apiKey.game]).many(3)
    await em.persist(leaderboards).flush()

    const res = await request(app)
      .get('/admin/v1/leaderboards')
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboards).toHaveLength(leaderboards.length)
  })

  it('should return 403 for a key missing the read:leaderboards scope', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_STATS])

    const res = await request(app)
      .get('/admin/v1/leaderboards')
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('read:leaderboards')
  })
})
