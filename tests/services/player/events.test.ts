import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import PlayerFactory from '../../fixtures/PlayerFactory'
import EventFactory from '../../fixtures/EventFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import { NodeClickHouseClient } from '@clickhouse/client/dist/client'

describe('Player service - get events', () => {
  it('should get a player\'s events', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    const events = await new EventFactory([player]).many(3)
    await (<NodeClickHouseClient>global.clickhouse).insert({
      table: 'events',
      values: events.map((event) => event.getInsertableData()),
      format: 'JSONEachRow'
    })

    const res = await request(global.app)
      .get(`/games/${game.id}/players/${player.id}/events`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(3)
  })

  it('should not get a player\'s events for a player they have no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const player = await new PlayerFactory([game]).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    await request(global.app)
      .get(`/games/${game.id}/players/${player.id}/events`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should return a filtered list of events', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    const events = await new EventFactory([player]).state(() => ({ name: 'Find secret' })).many(3)
    const otherEvents = await new EventFactory([player]).state(() => ({ name: 'Kill boss' })).many(3)
    await (<NodeClickHouseClient>global.clickhouse).insert({
      table: 'events',
      values: [...events, ...otherEvents].map((event) => event.getInsertableData()),
      format: 'JSONEachRow'
    })

    const res = await request(global.app)
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
    await (<EntityManager>global.em).persistAndFlush(player)

    const events = await new EventFactory([player]).many(count)
    await (<NodeClickHouseClient>global.clickhouse).insert({
      table: 'events',
      values: events.map((event) => event.getInsertableData()),
      format: 'JSONEachRow'
    })

    const res = await request(global.app)
      .get(`/games/${game.id}/players/${player.id}/events`)
      .query({ page: 1 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(count % 50)
    expect(res.body.count).toBe(count)
    expect(res.body.itemsPerPage).toBe(50)
  })

  it('should not get a player\'s events if they do not exist', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/players/21312321321/events`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
