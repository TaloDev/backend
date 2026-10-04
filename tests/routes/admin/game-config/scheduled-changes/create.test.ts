import { addDays } from 'date-fns'
import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../../src/entities/admin-api-key.js'
import { createAdminAPIKey } from '../../../../utils/createAdminAPIKey.js'

describe('Scheduled game config change admin API - create', () => {
  it('should schedule a change for a key with the write:gameConfig scope', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CONFIG])

    const res = await request(app)
      .post('/admin/v1/game-config/scheduled-changes')
      .send({
        changes: [{ key: 'xpRate', value: '3', applyAt: addDays(new Date(), 1).toISOString() }],
      })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.changes).toHaveLength(1)
    expect(res.body.changes[0].key).toBe('xpRate')
    expect(res.body.changes[0].value).toBe('3')
  })

  it('should return 403 for a key missing the write:gameConfig scope', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_GAME_CONFIG])

    const res = await request(app)
      .post('/admin/v1/game-config/scheduled-changes')
      .send({
        changes: [{ key: 'xpRate', value: '3', applyAt: addDays(new Date(), 1).toISOString() }],
      })
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:gameConfig')
  })
})
