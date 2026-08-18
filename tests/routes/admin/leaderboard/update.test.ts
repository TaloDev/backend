import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Leaderboard admin API - update', () => {
  it('should update a leaderboard for a key with the write:leaderboards scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await em.persist(leaderboard).flush()

    const res = await request(app)
      .put(`/admin/v1/leaderboards/${leaderboard.id}`)
      .send({ name: 'The new name' })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.name).toBe('The new name')

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_UPDATED,
      game: apiKey.game,
      adminAPIKey: apiKey,
      extra: {
        leaderboardInternalName: leaderboard.internalName,
      },
    })

    expect(activity).not.toBeNull()
  })

  it('should return 404 for a non-existent leaderboard', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])

    const res = await request(app)
      .put('/admin/v1/leaderboards/21312312')
      .send({ name: 'The new name' })
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })

  it('should return 403 for a key missing the write:leaderboards scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await em.persist(leaderboard).flush()

    const res = await request(app)
      .put(`/admin/v1/leaderboards/${leaderboard.id}`)
      .send({ name: 'The new name' })
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:leaderboards')
  })
})
