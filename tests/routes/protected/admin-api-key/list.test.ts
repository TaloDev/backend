import request from 'supertest'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Admin API key - list', () => {
  it('should return a list of admin api keys', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({}, organisation)

    await Promise.all(Array.from({ length: 3 }, () => createAdminAPIKey([], { game, user })))

    const res = await request(app)
      .get(`/games/${game.id}/admin-api-keys`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.apiKeys).toHaveLength(3)
  })

  it('should not return a list of admin api keys for a non-existent game', async () => {
    const [token] = await createUserAndToken({})

    const res = await request(app)
      .get('/games/99999/admin-api-keys')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return a list of admin api keys for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({})

    await request(app)
      .get(`/games/${game.id}/admin-api-keys`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not return revoked admin api keys', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({}, organisation)

    const { apiKey: active } = await createAdminAPIKey([], { game, user })
    const { apiKey: revokedKey } = await createAdminAPIKey([], { game, user })
    revokedKey.revokedAt = new Date()
    await em.flush()

    const res = await request(app)
      .get(`/games/${game.id}/admin-api-keys`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.apiKeys).toHaveLength(1)
    expect(res.body.apiKeys[0].id).toBe(active.id)
  })
})
