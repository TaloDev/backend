import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameChannelFactory from '../../../fixtures/GameChannelFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Game channel admin API - list', () => {
  it('should return a list of channels for a key with the read:gameChannels scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_GAME_CHANNELS])

    const channels = await new GameChannelFactory(apiKey.game).many(3)
    await em.persist(channels).flush()

    const res = await request(app)
      .get('/admin/v1/game-channels')
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.channels).toHaveLength(3)
    expect(res.body.count).toBe(3)
  })

  it('should return private channels', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_GAME_CHANNELS])

    const channels = await new GameChannelFactory(apiKey.game).many(2)
    const privateChannels = await new GameChannelFactory(apiKey.game).private().many(1)
    await em.persist([...channels, ...privateChannels]).flush()

    const res = await request(app)
      .get('/admin/v1/game-channels')
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.channels).toHaveLength(3)
  })

  it('should return 403 for a key missing the read:gameChannels scope', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CHANNELS])

    const res = await request(app)
      .get('/admin/v1/game-channels')
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('read:gameChannels')
  })
})
