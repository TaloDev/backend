import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import Prop from '../../../../src/entities/prop.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Game config admin API - get', () => {
  it('should return the live config for a key with the read:gameConfig scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_GAME_CONFIG])

    apiKey.game.props = [new Prop('xpRate', '2'), new Prop('maxLevel', '80')]
    await em.flush()

    const res = await request(app)
      .get('/admin/v1/game-config')
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.config).toEqual(
      expect.arrayContaining([
        { key: 'xpRate', value: '2' },
        { key: 'maxLevel', value: '80' },
      ]),
    )
  })

  it('should return 403 for a key missing the read:gameConfig scope', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CONFIG])

    const res = await request(app)
      .get('/admin/v1/game-config')
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('read:gameConfig')
  })
})
