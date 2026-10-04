import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Player admin API - get', () => {
  it('should return a player for a key with the read:players scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .get(`/admin/v1/players/${player.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.id).toBe(player.id)
    expect(res.body.player.aliases).toHaveLength(player.aliases.length)
  })

  it('should return 403 for a key missing the read:players scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .get(`/admin/v1/players/${player.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('read:players')
  })

  it('should return 404 for a non-existent player', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_PLAYERS])

    const res = await request(app)
      .get('/admin/v1/players/non-existent-id')
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should return 404 for a player in another game', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_PLAYERS])
    const { apiKey: otherKey } = await createAdminAPIKey([AdminAPIKeyScope.READ_PLAYERS])

    const player = await new PlayerFactory([otherKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .get(`/admin/v1/players/${player.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
