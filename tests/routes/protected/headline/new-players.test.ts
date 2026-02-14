import request from 'supertest'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import { sub, format } from 'date-fns'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Headline  - new players', () => {
  const startDate = format(sub(new Date(), { days: 7 }), 'yyyy-MM-dd')
  const endDate = format(new Date(), 'yyyy-MM-dd')

  it('should return the correct number of new players this week', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const newPlayers = await new PlayerFactory([game]).createdThisWeek().many(10)
    const oldPlayers = await new PlayerFactory([game]).notCreatedThisWeek().many(10)
    await em.persist([...newPlayers, ...oldPlayers]).flush()

    const res = await request(app)
      .get(`/games/${game.id}/headlines/new_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(10)
  })

  it('should not return new dev build players without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const newPlayers = await new PlayerFactory([game]).createdThisWeek().devBuild().many(10)
    await em.persist(newPlayers).flush()

    const res = await request(app)
      .get(`/games/${game.id}/headlines/new_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return new dev build players with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const newPlayers = await new PlayerFactory([game]).createdThisWeek().devBuild().many(10)
    await em.persist(newPlayers).flush()

    const res = await request(app)
      .get(`/games/${game.id}/headlines/new_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(10)
  })

  it('should not return headlines for a game the user cant access', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({})

    await request(app)
      .get(`/games/${game.id}/headlines/new_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
