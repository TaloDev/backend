import { addDays } from 'date-fns'
import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../../src/entities/admin-api-key.js'
import ScheduledGameConfigChange from '../../../../../src/entities/scheduled-game-config-change.js'
import { createAdminAPIKey } from '../../../../utils/createAdminAPIKey.js'

describe('Scheduled game config change admin API - delete', () => {
  it('should cancel a scheduled change for a key with the write:gameConfig scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CONFIG])

    const change = new ScheduledGameConfigChange(
      apiKey.game,
      apiKey,
      'xpRate',
      '3',
      addDays(new Date(), 1),
    )
    await em.persist(change).flush()

    await request(app)
      .delete(`/admin/v1/game-config/scheduled-changes/${change.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(204)

    expect(await em.refresh(change)).toBeNull()
  })

  it('should return 404 for a non-existent change', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CONFIG])

    const res = await request(app)
      .delete('/admin/v1/game-config/scheduled-changes/21312312')
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body.message).toBe('Scheduled game config change not found')
  })

  it('should return 404 for a change belonging to another game', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CONFIG])
    const other = await createAdminAPIKey()

    const change = new ScheduledGameConfigChange(
      other.apiKey.game,
      other.apiKey,
      'xpRate',
      '3',
      addDays(new Date(), 1),
    )
    await em.persist(change).flush()

    const res = await request(app)
      .delete(`/admin/v1/game-config/scheduled-changes/${change.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body.message).toBe('Scheduled game config change not found')
  })

  it('should return 403 for a key missing the write:gameConfig scope', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_GAME_CONFIG])

    const res = await request(app)
      .delete('/admin/v1/game-config/scheduled-changes/1')
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:gameConfig')
  })
})
