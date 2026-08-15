import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameStatFactory from '../../../fixtures/GameStatFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Game stat admin API - list', () => {
  it('should return a list of game stats for a key with the read:stats scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_STATS])

    const stats = await new GameStatFactory([apiKey.game]).many(3)
    await em.persist(stats).flush()

    const res = await request(app)
      .get('/admin/v1/game-stats')
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.stats).toHaveLength(stats.length)
  })

  it('should return 403 for a key missing the read:stats scope', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_STATS])

    const res = await request(app)
      .get('/admin/v1/game-stats')
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('read:stats')
  })
})
