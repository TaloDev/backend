import { sub, format } from 'date-fns'
import request from 'supertest'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Headline - returning players', () => {
  const startDate = format(sub(new Date(), { days: 7 }), 'yyyy-MM-dd')
  const endDate = format(new Date(), 'yyyy-MM-dd')

  it('should return the correct number of returning players this week', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const playersNotSeenThisWeek = await new PlayerFactory([game]).notSeenThisWeek().many(6)

    const returningPlayersSeenThisWeek = await new PlayerFactory([game])
      .seenThisWeek()
      .notCreatedThisWeek()
      .many(4)

    const playersSignedupThisWeek = await new PlayerFactory([game]).notSeenThisWeek().many(5)
    await em
      .persist([
        ...playersNotSeenThisWeek,
        ...returningPlayersSeenThisWeek,
        ...playersSignedupThisWeek,
      ])
      .flush()

    const res = await request(app)
      .get(`/games/${game.id}/headlines/returning_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(4)
  })

  it('should not return returning dev build players without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const returningPlayersSeenThisWeek = await new PlayerFactory([game])
      .seenThisWeek()
      .notCreatedThisWeek()
      .devBuild()
      .many(4)

    await em.persist(returningPlayersSeenThisWeek).flush()

    const res = await request(app)
      .get(`/games/${game.id}/headlines/returning_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return returning dev build players with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const returningPlayersSeenThisWeek = await new PlayerFactory([game])
      .seenThisWeek()
      .notCreatedThisWeek()
      .devBuild()
      .many(4)

    await em.persist(returningPlayersSeenThisWeek).flush()

    const res = await request(app)
      .get(`/games/${game.id}/headlines/returning_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(4)
  })
})
