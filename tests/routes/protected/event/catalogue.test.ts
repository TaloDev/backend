import { sub, subDays } from 'date-fns'
import request from 'supertest'
import EventRetention from '../../../../src/entities/event-retention.js'
import { UserType } from '../../../../src/entities/user.js'
import EventFactory from '../../../fixtures/EventFactory.js'
import GameFactory from '../../../fixtures/GameFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Event - catalogue', () => {
  it('should return event names, counts, unique players, prop keys and retention days', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persist(player)

    const events = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory' }))
      .many(3)

    await em.persist(player).flush()
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
      .get(`/games/${game.id}/events/catalogue`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
    expect(res.body.events).toHaveLength(1)
    expect(res.body.events[0]).toMatchObject({
      name: 'Open inventory',
      count: 3,
      players: new Set(events.map((event) => event.playerAlias.id)).size,
      propKeys: ['version'],
      retentionDays: null,
    })
  })

  it('should paginate the catalogue', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persist(player)

    const events = await new EventFactory([player])
      .state((event, idx) => ({ name: `Event ${idx}`, createdAt: new Date() }))
      .many(51)

    await em.persist(player).flush()
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const pageOne = await request(app)
      .get(`/games/${game.id}/events/catalogue`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(pageOne.body.count).toBe(51)
    expect(pageOne.body.isLastPage).toBe(false)
    expect(pageOne.body.events).toHaveLength(50)

    const pageTwo = await request(app)
      .get(`/games/${game.id}/events/catalogue`)
      .query({ page: 1 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(pageTwo.body.events).toHaveLength(1)
    expect(pageTwo.body.isLastPage).toBe(true)

    const pageThree = await request(app)
      .get(`/games/${game.id}/events/catalogue`)
      .query({ page: 2 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(pageThree.body.events).toHaveLength(0)
    expect(pageThree.body.isLastPage).toBe(true)
  })

  it('should return retention days when configured', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    await em.persist(new EventRetention(game, 'Boss defeated', 30)).flush()

    const res = await request(app)
      .get(`/games/${game.id}/events/catalogue`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(1)
    expect(res.body.events).toStrictEqual([
      {
        name: 'Boss defeated',
        count: 0,
        players: 0,
        propKeys: [],
        retentionDays: 30,
      },
    ])
  })

  it('should count stored events even if past their retention period', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persist(player)

    const events = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory', createdAt: subDays(new Date(), 40) }))
      .many(2)

    await em.persist(player).flush()
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

    await em.persist(new EventRetention(game, 'Open inventory', 30)).flush()

    const res = await request(app)
      .get(`/games/${game.id}/events/catalogue`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(1)
    expect(res.body.events).toStrictEqual([
      {
        name: 'Open inventory',
        count: 2,
        players: new Set(events.map((event) => event.playerAlias.id)).size,
        propKeys: ['version'],
        retentionDays: 30,
      },
    ])
  })

  it('should not return events from dev build players if the dev data header is not set', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    const events = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory' }))
      .many(3)

    await em.persist(player).flush()
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get(`/games/${game.id}/events/catalogue`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
    expect(res.body.events).toHaveLength(0)
  })

  it('should return events from dev build players if the dev data header is set', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    const events = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory' }))
      .many(3)

    await em.persist(player).flush()
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get(`/games/${game.id}/events/catalogue`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(1)
    expect(res.body.events[0]).toMatchObject({ name: 'Open inventory', count: 3 })
  })

  it('should serve cached aggregations on subsequent requests', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const events = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory' }))
      .many(3)

    await em.persist(player).flush()
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const first = await request(app)
      .get(`/games/${game.id}/events/catalogue`)
      .auth(token, { type: 'bearer' })
      .expect(200)
    expect(first.body.events[0]).toMatchObject({ count: 3 })

    const moreEvents = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory' }))
      .many(2)
    await clickhouse.insert({
      table: 'events',
      values: moreEvents.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const second = await request(app)
      .get(`/games/${game.id}/events/catalogue`)
      .auth(token, { type: 'bearer' })
      .expect(200)
    expect(second.body.events[0]).toMatchObject({ count: 3 })
  })

  it('should cache dev and non-dev data separately', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const devPlayer = await new PlayerFactory([game]).devBuild().one()
    await em.persist(player).flush()
    await em.persist(devPlayer).flush()

    const events = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory' }))
      .many(1)
    const devEvents = await new EventFactory([devPlayer])
      .state(() => ({ name: 'Open inventory' }))
      .many(2)

    await clickhouse.insert({
      table: 'events',
      values: [...events, ...devEvents].map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const devRes = await request(app)
      .get(`/games/${game.id}/events/catalogue`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)
    expect(devRes.body.events[0]).toMatchObject({ count: 3 })

    const nonDevRes = await request(app)
      .get(`/games/${game.id}/events/catalogue`)
      .auth(token, { type: 'bearer' })
      .expect(200)
    expect(nonDevRes.body.events[0]).toMatchObject({ count: 1 })
  })

  it('should invalidate the cache after a purge', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const player = await new PlayerFactory([game]).one()
    const events = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory', createdAt: sub(new Date(), { minutes: 30 }) }))
      .many(2)

    await em.persist(player).flush()
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const before = await request(app)
      .get(`/games/${game.id}/events/catalogue`)
      .auth(token, { type: 'bearer' })
      .expect(200)
    expect(before.body.events[0]).toMatchObject({ count: 2 })

    await request(app)
      .delete(`/games/${game.id}/events/purge`)
      .query({ eventName: 'Open inventory' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const after = await request(app)
      .get(`/games/${game.id}/events/catalogue`)
      .auth(token, { type: 'bearer' })
      .expect(200)
    expect(after.body.count).toBe(0)
  })

  it('should not return events from another game with the same name', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const otherGame = await new GameFactory(organisation).one()
    await em.persist(otherGame).flush()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const otherPlayer = await new PlayerFactory([otherGame]).one()
    await em.persist(player).flush()
    await em.persist(otherPlayer).flush()

    const events = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory' }))
      .many(2)
    const otherEvents = await new EventFactory([otherPlayer])
      .state(() => ({ name: 'Open inventory' }))
      .many(3)

    await clickhouse.insert({
      table: 'events',
      values: [...events, ...otherEvents].map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get(`/games/${game.id}/events/catalogue`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(1)
    expect(res.body.events[0]).toMatchObject({ name: 'Open inventory', count: 2 })
  })
})
