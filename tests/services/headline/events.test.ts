import request from 'supertest'
import EventFactory from '../../fixtures/EventFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import { sub, format } from 'date-fns'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'

describe('Headline service - events', () => {
  const startDate = format(sub(new Date(), { days: 7 }), 'yyyy-MM-dd')
  const endDate = format(new Date(), 'yyyy-MM-dd')

  it('should return the correct number of new events this week', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    const events = await new EventFactory([player]).thisWeek().many(10)
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/games/${game.id}/headlines/events`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(10)
  })

  it('should not return new events for dev build players without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    await em.persist(player).flush()

    const events = await new EventFactory([player]).thisWeek().many(10)
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/games/${game.id}/headlines/events`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return new events for dev build players with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    await em.persist(player).flush()

    const events = await new EventFactory([player]).thisWeek().many(10)
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/games/${game.id}/headlines/events`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(10)
  })
})
