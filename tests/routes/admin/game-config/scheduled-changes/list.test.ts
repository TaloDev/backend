import { addDays } from 'date-fns'
import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../../src/entities/admin-api-key.js'
import ScheduledGameConfigChange from '../../../../../src/entities/scheduled-game-config-change.js'
import { createAdminAPIKey } from '../../../../utils/createAdminAPIKey.js'

describe('Scheduled game config change admin API - list', () => {
  it('should list the changes for the key game', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_GAME_CONFIG])
    const other = await createAdminAPIKey()

    await em
      .persist([
        new ScheduledGameConfigChange(apiKey.game, apiKey, 'xpRate', '2', addDays(new Date(), 1)),
        new ScheduledGameConfigChange(
          other.apiKey.game,
          other.apiKey,
          'xpRate',
          '3',
          addDays(new Date(), 1),
        ),
      ])
      .flush()

    const res = await request(app)
      .get('/admin/v1/game-config/scheduled-changes')
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.changes).toHaveLength(1)
    expect(res.body.changes[0].value).toBe('2')
  })

  it('should return 403 for a key missing the read:gameConfig scope', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CONFIG])

    const res = await request(app)
      .get('/admin/v1/game-config/scheduled-changes')
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('read:gameConfig')
  })
})
