import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import Leaderboard from '../../../../src/entities/leaderboard.js'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Leaderboard admin API - delete', () => {
  it('should delete a leaderboard for a key with the write:leaderboards scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await em.persist(leaderboard).flush()

    const res = await request(app)
      .delete(`/admin/v1/leaderboards/${leaderboard.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(204)

    expect(res.body).toStrictEqual({})

    const deleted = await em.repo(Leaderboard).find({ id: leaderboard.id })
    expect(deleted).toHaveLength(0)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_DELETED,
      game: apiKey.game,
    })
    expect(activity?.extra.leaderboardInternalName).toBe(leaderboard.internalName)
  })

  it('should return 404 for a non-existent leaderboard', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])

    const res = await request(app)
      .delete('/admin/v1/leaderboards/21312312')
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body.message).toBe('Leaderboard not found')
  })

  it('should return 403 for a key missing the write:leaderboards scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await em.persist(leaderboard).flush()

    const res = await request(app)
      .delete(`/admin/v1/leaderboards/${leaderboard.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:leaderboards')

    const remaining = await em.repo(Leaderboard).find({ id: leaderboard.id })
    expect(remaining).toHaveLength(1)
  })

  it('should return 404 for a leaderboard in another game', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])
    const { apiKey: otherKey } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([otherKey.game]).one()
    await em.persist(leaderboard).flush()

    const res = await request(app)
      .delete(`/admin/v1/leaderboards/${leaderboard.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body.message).toBe('Leaderboard not found')

    const remaining = await em.repo(Leaderboard).find({ id: leaderboard.id })
    expect(remaining).toHaveLength(1)
  })
})
