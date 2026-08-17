import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Leaderboard admin API - create', () => {
  it('should create a leaderboard for a key with the write:leaderboards scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])

    const res = await request(app)
      .post('/admin/v1/leaderboards')
      .send({
        internalName: 'highscores',
        name: 'Highscores',
        sortMode: 'desc',
        unique: true,
        refreshInterval: 'never',
      })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.internalName).toBe('highscores')
    expect(res.body.leaderboard.name).toBe('Highscores')

    const activity = await em.repo(GameActivity).findOneOrFail({
      type: GameActivityType.LEADERBOARD_CREATED,
      game: apiKey.game,
      adminAPIKey: apiKey,
    })
    expect(activity.adminAPIKey?.id).toBe(apiKey.id)
  })

  it('should return 403 for a key missing the write:leaderboards scope', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_STATS])

    const res = await request(app)
      .post('/admin/v1/leaderboards')
      .send({
        internalName: 'highscores',
        name: 'Highscores',
        sortMode: 'desc',
        unique: true,
        refreshInterval: 'never',
      })
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:leaderboards')
  })
})
