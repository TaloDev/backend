import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import Prop from '../../../../src/entities/prop.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Game config admin API - update', () => {
  it('should update the live config for a key with the write:gameConfig scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CONFIG])

    apiKey.game.props = [new Prop('xpRate', '1')]
    await em.flush()

    const res = await request(app)
      .patch('/admin/v1/game-config')
      .send({
        props: [{ key: 'xpRate', value: '2' }],
      })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.game.props).toStrictEqual([{ key: 'xpRate', value: '2' }])
  })

  it('should return 403 for a key missing the write:gameConfig scope', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_GAME_CONFIG])

    const res = await request(app)
      .patch('/admin/v1/game-config')
      .send({
        props: [{ key: 'xpRate', value: '2' }],
      })
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:gameConfig')
  })
})
