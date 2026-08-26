import request from 'supertest'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Headline - clear', () => {
  it('should serve the cached response until the cache is manually cleared', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const players = await new PlayerFactory([game]).many(3)
    await em.persist(players).flush()

    const first = await request(app)
      .get(`/games/${game.id}/headlines/total_players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    const second = await request(app)
      .get(`/games/${game.id}/headlines/total_players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(second.body.lastUpdatedAt).toBe(first.body.lastUpdatedAt)

    await request(app)
      .delete(`/games/${game.id}/headlines`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    const third = await request(app)
      .get(`/games/${game.id}/headlines/total_players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(third.body.lastUpdatedAt).toBeGreaterThan(first.body.lastUpdatedAt)
  })

  it('should not allow clearing headlines for a game the user cant access', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(app)
      .delete(`/games/${game.id}/headlines`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
