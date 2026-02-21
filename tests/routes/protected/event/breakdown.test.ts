import { addDays, sub } from 'date-fns'
import request from 'supertest'
import EventFactory from '../../../fixtures/EventFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Event - breakdown', () => {
  it('should return a breakdown of an event', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const now = new Date('2021-01-01')

    const events = await new EventFactory([player])
      .state((event, idx) => ({
        name: 'Pickup item',
        createdAt: addDays(now, idx),
        props: [
          { key: 'itemId', value: idx.toString() },
          { key: 'inventorySize', value: '16' },
        ],
      }))
      .many(2)

    await em.persistAndFlush(player)
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
      .get(`/games/${game.id}/events/breakdown`)
      .query({ eventName: 'Pickup item', startDate: '2021-01-01', endDate: '2021-01-03' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(Object.keys(res.body.events)).toHaveLength(3)

    // itemId = 0 should have 3 entries (Jan 1-3), with the event on Jan 1
    expect(res.body.events['[itemId = 0]']).toHaveLength(3)
    expect(res.body.events['[itemId = 0]'][0]).toEqual({
      name: '[itemId = 0]',
      date: now.getTime(),
      count: 1,
      change: 1,
    })

    // itemId = 1 should have 3 entries (Jan 1-3), with the event on Jan 2
    expect(res.body.events['[itemId = 1]']).toHaveLength(3)
    expect(res.body.events['[itemId = 1]'][1]).toEqual({
      name: '[itemId = 1]',
      date: addDays(now, 1).getTime(),
      count: 1,
      change: 1,
    })

    // inventorySize = 16 should have 3 entries (Jan 1-3), with events on Jan 1 and Jan 2
    expect(res.body.events['[inventorySize = 16]']).toHaveLength(3)
    expect(res.body.events['[inventorySize = 16]'][0]).toEqual({
      name: '[inventorySize = 16]',
      date: now.getTime(),
      count: 1,
      change: 1,
    })

    expect(res.body.events['[inventorySize = 16]'][1]).toEqual({
      name: '[inventorySize = 16]',
      date: addDays(now, 1).getTime(),
      count: 1,
      change: 0,
    })
  })

  it('should correctly calculate breakdown changes', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const now = new Date('2021-01-01')

    const eventFactory = new EventFactory([player])
    const firstEvent = await eventFactory
      .state(() => ({
        name: 'Pickup item',
        createdAt: now,
        props: [{ key: 'itemId', value: '1' }],
      }))
      .one()

    const moreEvents = await eventFactory
      .state(() => ({
        name: 'Pickup item',
        createdAt: addDays(now, 1),
        props: [{ key: 'itemId', value: '1' }],
      }))
      .many(2)

    const evenMoreEvents = await eventFactory
      .state(() => ({
        name: 'Pickup item',
        createdAt: addDays(now, 2),
        props: [{ key: 'itemId', value: '1' }],
      }))
      .many(3)

    const lastEvent = await eventFactory
      .state(() => ({
        name: 'Pickup item',
        createdAt: addDays(now, 3),
        props: [{ key: 'itemId', value: '1' }],
      }))
      .one()

    const events = [firstEvent, ...moreEvents, ...evenMoreEvents, lastEvent]

    await em.persistAndFlush(player)
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
      .get(`/games/${game.id}/events/breakdown`)
      .query({ eventName: 'Pickup item', startDate: '2021-01-01', endDate: '2021-01-05' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events['[itemId = 1]'][0].change).toBe(1)
    expect(res.body.events['[itemId = 1]'][1].change).toBe(1)
    expect(res.body.events['[itemId = 1]'][2].change).toBe(0.5)
    expect(res.body.events['[itemId = 1]'][3].change.toFixed(2)).toBe('-0.67')
  })

  it('should not return a breakdown for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .get('/games/99999/events/breakdown')
      .query({ eventName: 'Pickup item', startDate: '2021-01-01', endDate: '2021-01-05' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return a breakdown for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(app)
      .get(`/games/${game.id}/events/breakdown`)
      .query({ eventName: 'Pickup item', startDate: '2021-01-01', endDate: '2021-01-05' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should return event props from today if the endDate is today', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const events = await new EventFactory([player])
      .state(() => ({
        name: 'Pickup item',
        createdAt: new Date(),
        props: [{ key: 'itemId', value: '1' }],
      }))
      .many(3)
    await em.persistAndFlush(player)

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
      .get(`/games/${game.id}/events/breakdown`)
      .query({
        eventName: 'Pickup item',
        startDate: sub(new Date(), { days: 1 }),
        endDate: new Date(),
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    // should have 2 entries (yesterday and today)
    expect(res.body.events['[itemId = 1]']).toHaveLength(2)
    // yesterday should have 0 events
    expect(res.body.events['[itemId = 1]'][0].count).toBe(0)
    // today should have the actual events
    expect(res.body.events['[itemId = 1]'][1].count).toBe(events.length)
  })

  it('should not return event props by dev build players if the dev data header is not set', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    const events = await new EventFactory([player])
      .state(() => ({
        name: 'Pickup item',
        createdAt: new Date(),
        props: [{ key: 'itemId', value: '1' }],
      }))
      .many(3)
    await em.persistAndFlush(player)

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
      .get(`/games/${game.id}/events/breakdown`)
      .query({
        eventName: 'Pickup item',
        startDate: sub(new Date(), { days: 1 }),
        endDate: new Date(),
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toStrictEqual({})
  })

  it('should return event props by dev build players if the dev data header is set', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    const events = await new EventFactory([player])
      .state(() => ({
        name: 'Pickup item',
        createdAt: new Date(),
        props: [{ key: 'itemId', value: '1' }],
      }))
      .many(3)
    await em.persistAndFlush(player)

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
      .get(`/games/${game.id}/events/breakdown`)
      .query({
        eventName: 'Pickup item',
        startDate: sub(new Date(), { days: 1 }),
        endDate: new Date(),
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    // should have 2 entries (yesterday and today)
    expect(res.body.events['[itemId = 1]']).toHaveLength(2)
    // yesterday should have 0 events
    expect(res.body.events['[itemId = 1]'][0].count).toBe(0)
    // today should have the actual events
    expect(res.body.events['[itemId = 1]'][1].count).toBe(events.length)
  })

  it('should not return breakdowns for meta props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const now = new Date('2021-01-01')

    const events = await new EventFactory([player])
      .state((event, idx) => ({
        name: 'Pickup item',
        createdAt: addDays(now, idx),
        props: [{ key: 'META_SCREEN_WIDTH', value: '1920' }],
      }))
      .many(2)

    await em.persistAndFlush(player)
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
      .get(`/games/${game.id}/events/breakdown`)
      .query({ eventName: 'Pickup item', startDate: '2021-01-01', endDate: '2021-01-03' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(Object.keys(res.body.events)).toHaveLength(0)
  })

  it('should include dates with zero counts in the breakdown results', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const now = new Date('2021-01-01')

    // create events only on Jan 1st and Jan 4th, leaving Jan 2nd and 3rd empty
    const events = await new EventFactory([player])
      .state(() => ({
        name: 'Pickup item',
        createdAt: now,
        props: [{ key: 'itemId', value: '5' }],
      }))
      .many(2)

    const moreEvents = await new EventFactory([player])
      .state(() => ({
        name: 'Pickup item',
        createdAt: addDays(now, 3),
        props: [{ key: 'itemId', value: '5' }],
      }))
      .many(3)

    await em.persistAndFlush(player)
    await clickhouse.insert({
      table: 'events',
      values: [...events, ...moreEvents].map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })
    await clickhouse.insert({
      table: 'event_props',
      values: [...events, ...moreEvents].flatMap((event) => event.getInsertableProps()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get(`/games/${game.id}/events/breakdown`)
      .query({ eventName: 'Pickup item', startDate: '2021-01-01', endDate: '2021-01-04' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    // should have 4 entries (one for each day in the range)
    expect(res.body.events['[itemId = 5]']).toHaveLength(4)

    // Jan 1st should have 2 events
    expect(res.body.events['[itemId = 5]'][0]).toEqual({
      name: '[itemId = 5]',
      date: now.getTime(),
      count: 2,
      change: 2, // when previous is 0 and count is not 0, change is count
    })

    // Jan 2nd should have 0 events
    expect(res.body.events['[itemId = 5]'][1]).toEqual({
      name: '[itemId = 5]',
      date: addDays(now, 1).getTime(),
      count: 0,
      change: -1,
    })

    // Jan 3rd should have 0 events
    expect(res.body.events['[itemId = 5]'][2]).toEqual({
      name: '[itemId = 5]',
      date: addDays(now, 2).getTime(),
      count: 0,
      change: 0,
    })

    // Jan 4th should have 3 events
    expect(res.body.events['[itemId = 5]'][3]).toEqual({
      name: '[itemId = 5]',
      date: addDays(now, 3).getTime(),
      count: 3,
      change: 3, // when previous is 0 and count is not 0, change is count
    })
  })
})
