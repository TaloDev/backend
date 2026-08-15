import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Game stat admin API - create', () => {
  it('should create a stat for a key with the write:stats scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_STATS])

    const res = await request(app)
      .post('/admin/v1/game-stats')
      .send({
        internalName: 'levels-completed',
        name: 'Levels completed',
        defaultValue: 0,
        global: false,
        minTimeBetweenUpdates: 0,
        minValue: -10,
        maxValue: 10,
        maxChange: 1,
      })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.internalName).toBe('levels-completed')
    expect(res.body.stat.name).toBe('Levels completed')

    const activity = await em.repo(GameActivity).findOneOrFail({
      type: GameActivityType.GAME_STAT_CREATED,
      game: apiKey.game,
      adminAPIKey: apiKey,
    })
    expect(activity.adminAPIKey?.id).toBe(apiKey.id)
  })

  it('should return 403 for a key missing the write:stats scope', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_STATS])

    const res = await request(app)
      .post('/admin/v1/game-stats')
      .send({
        internalName: 'levels-completed',
        name: 'Levels completed',
        defaultValue: 0,
        global: false,
        minTimeBetweenUpdates: 0,
        minValue: -10,
        maxValue: 10,
        maxChange: 1,
      })
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:stats')
  })
})
