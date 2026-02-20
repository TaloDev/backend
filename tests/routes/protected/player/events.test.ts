import request from 'supertest'
import EventFactory from '../../../fixtures/EventFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Player - get events', () => {
  it("should get a player's events", async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush(player)

    const events = await new EventFactory([player]).many(3)
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })
    await clickhouse.insert({
      table: 'event_props',
      values: events.flatMap((event) => event.getInsertableProps()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get(`/games/${game.id}/players/${player.id}/events`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(3)
  })

  it("should not get a player's events for a player they have no access to", async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .get(`/games/${game.id}/players/${player.id}/events`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should return a filtered list of events', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush(player)

    const events = await new EventFactory([player]).state(() => ({ name: 'Find secret' })).many(3)
    const otherEvents = await new EventFactory([player])
      .state(() => ({ name: 'Kill boss' }))
      .many(3)
    await clickhouse.insert({
      table: 'events',
      values: [...events, ...otherEvents].map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get(`/games/${game.id}/players/${player.id}/events`)
      .query({ search: 'Find secret', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(3)
  })

  it('should paginate results when getting player events', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const count = 82

    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush(player)

    const events = await new EventFactory([player]).many(count)
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get(`/games/${game.id}/players/${player.id}/events`)
      .query({ page: 1 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(count % 50)
    expect(res.body.count).toBe(count)
    expect(res.body.itemsPerPage).toBe(50)
  })

  it("should not get a player's events if they do not exist", async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .get(`/games/${game.id}/players/21312321321/events`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
