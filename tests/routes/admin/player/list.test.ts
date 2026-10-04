import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Player admin API - list', () => {
  it('should return a list of players for a key with the read:players scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_PLAYERS])

    const players = await new PlayerFactory([apiKey.game]).many(3)
    await em.persist(players).flush()

    const res = await request(app)
      .get('/admin/v1/players')
      .query({ page: 0 })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(players.length)
    expect(res.body.count).toBe(players.length)
    expect(res.body.itemsPerPage).toBe(25)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should not return dev build players without the dev data header', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_PLAYERS])

    const players = await new PlayerFactory([apiKey.game]).devBuild().many(3)
    await em.persist(players).flush()

    const res = await request(app)
      .get('/admin/v1/players')
      .query({ page: 0 })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return dev build players with the dev data header', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_PLAYERS])

    const players = await new PlayerFactory([apiKey.game]).devBuild().many(3)
    await em.persist(players).flush()

    const res = await request(app)
      .get('/admin/v1/players')
      .query({ page: 0 })
      .auth(keyString, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(players.length)
  })

  it('should return 403 for a key missing the read:players scope', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_PLAYERS])

    const res = await request(app)
      .get('/admin/v1/players')
      .query({ page: 0 })
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('read:players')
  })
})
