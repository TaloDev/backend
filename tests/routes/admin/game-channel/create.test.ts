import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Game channel admin API - create', () => {
  it('should create a game channel for a key with the write:gameChannels scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CHANNELS])

    const res = await request(app)
      .post('/admin/v1/game-channels')
      .send({ name: 'Test channel', props: [], autoCleanup: false })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.channel.name).toBe('Test channel')

    const activity = await em.repo(GameActivity).findOneOrFail({
      type: GameActivityType.GAME_CHANNEL_CREATED,
      game: apiKey.game,
      adminAPIKey: apiKey,
    })
    expect(activity.extra.channelName).toBe('Test channel')
  })

  it('should return 403 for a key missing the write:gameChannels scope', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_GAME_CHANNELS])

    const res = await request(app)
      .post('/admin/v1/game-channels')
      .send({ name: 'Test channel' })
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:gameChannels')
  })
})
