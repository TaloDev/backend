import request from 'supertest'
import APIKey from '../../../../src/entities/api-key'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('API key - list', () => {
  it('should return a list of api keys', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({}, organisation)

    const keys: APIKey[] = Array.from({ length: 3 }).map(() => new APIKey(game, user))
    await em.persistAndFlush(keys)

    const res = await request(app)
      .get(`/games/${game.id}/api-keys`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.apiKeys).toHaveLength(keys.length)
  })

  it('should not return a list of api keys for a non-existent game', async () => {
    const [token] = await createUserAndToken({})

    const res = await request(app)
      .get('/games/99999/api-keys')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return a list of api keys for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({})

    await request(app).get(`/games/${game.id}/api-keys`).auth(token, { type: 'bearer' }).expect(403)
  })
})
