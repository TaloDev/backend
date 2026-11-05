import request from 'supertest'
import GameFactory from '../../../fixtures/GameFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('User - me', () => {
  it("should return the user's data", async () => {
    const [organisation] = await createOrganisationAndGame({}, { name: 'Vigilante 2084' })
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app).get('/users/me').auth(token, { type: 'bearer' }).expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.user.organisation).toBeTruthy()
    expect(res.body.user.organisation.games).toHaveLength(1)
    expect(res.body.user.organisation.games[0].name).toBe('Vigilante 2084')
  })

  it('should return games in switcher order', async () => {
    const [organisation, lastGame] = await createOrganisationAndGame({}, { switcherOrder: 2 })
    const middleGame = await new GameFactory(organisation).state(() => ({ switcherOrder: 1 })).one()
    const firstGame = await new GameFactory(organisation).state(() => ({ switcherOrder: 0 })).one()
    await em.persist([firstGame, middleGame]).flush()

    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app).get('/users/me').auth(token, { type: 'bearer' }).expect(200)

    expect(res.body.user.organisation.games.map((game: { id: number }) => game.id)).toStrictEqual([
      firstGame.id,
      middleGame.id,
      lastGame.id,
    ])
  })
})
