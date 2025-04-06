import request from 'supertest'
import EventFactory from '../../fixtures/EventFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import { addDays, sub } from 'date-fns'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'

describe('Event service - breakdown', () => {
  it('should return a breakdown of an event', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const now = new Date('2021-01-01')

    const events = await new EventFactory([player]).state((event, idx) => ({
      name: 'Pickup item',
      createdAt: addDays(now, idx),
      props: [
        { key: 'itemId', value: idx.toString() },
        { key: 'inventorySize', value: '16' }
      ]
    })).many(2)

    await em.persistAndFlush(player)
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow'
    })
    await clickhouse.insert({
      table: 'event_props',
      values: events.flatMap((event) => event.getInsertableProps()),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/games/${game.id}/events/breakdown`)
      .query({ eventName: 'Pickup item', startDate: '2021-01-01', endDate: '2021-01-03' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(Object.keys(res.body.events)).toHaveLength(3)

    expect(res.body.events['[itemId = 0]'][0]).toEqual({
      name: '[itemId = 0]',
      date: now.getTime(),
      count: 1,
      change: 1
    })

    expect(res.body.events['[itemId = 1]'][0]).toEqual({
      name: '[itemId = 1]',
      date: addDays(now, 1).getTime(),
      count: 1,
      change: 1
    })

    expect(res.body.events['[inventorySize = 16]'][0]).toEqual({
      name: '[inventorySize = 16]',
      date: now.getTime(),
      count: 1,
      change: 1
    })

    expect(res.body.events['[inventorySize = 16]'][1]).toEqual({
      name: '[inventorySize = 16]',
      date: addDays(now, 1).getTime(),
      count: 1,
      change: 0
    })
  })

  it('should correctly calculate breakdown changes', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const now = new Date('2021-01-01')

    const eventFactory = new EventFactory([player])
    const firstEvent = await eventFactory.state(() => ({
      name: 'Pickup item',
      createdAt: now,
      props: [
        { key: 'itemId', value: '1' }
      ]
    })).one()

    const moreEvents = await eventFactory.state(() => ({
      name: 'Pickup item',
      createdAt: addDays(now, 1),
      props: [
        { key: 'itemId', value: '1' }
      ]
    })).many(2)

    const evenMoreEvents = await eventFactory.state(() => ({
      name: 'Pickup item',
      createdAt: addDays(now, 2),
      props: [
        { key: 'itemId', value: '1' }
      ]
    })).many(3)

    const lastEvent = await eventFactory.state(() => ({
      name: 'Pickup item',
      createdAt: addDays(now, 3),
      props: [
        { key: 'itemId', value: '1' }
      ]
    })).one()

    const events = [
      firstEvent,
      ...moreEvents,
      ...evenMoreEvents,
      lastEvent
    ]

    await em.persistAndFlush(player)
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow'
    })
    await clickhouse.insert({
      table: 'event_props',
      values: events.flatMap((event) => event.getInsertableProps()),
      format: 'JSONEachRow'
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
    const events = await new EventFactory([player]).state(() => ({
      name: 'Pickup item',
      createdAt: new Date(),
      props: [
        { key: 'itemId', value: '1' }
      ]
    })).many(3)
    await em.persistAndFlush(player)

    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow'
    })
    await clickhouse.insert({
      table: 'event_props',
      values: events.flatMap((event) => event.getInsertableProps()),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/games/${game.id}/events/breakdown`)
      .query({ eventName: 'Pickup item', startDate: sub(new Date(), { days: 1 }), endDate: new Date() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events['[itemId = 1]'][0].count).toBe(events.length)
  })

  it('should not return event props by dev build players if the dev data header is not set', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    const events = await new EventFactory([player]).state(() => ({
      name: 'Pickup item',
      createdAt: new Date(),
      props: [
        { key: 'itemId', value: '1' }
      ]
    })).many(3)
    await em.persistAndFlush(player)

    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow'
    })
    await clickhouse.insert({
      table: 'event_props',
      values: events.flatMap((event) => event.getInsertableProps()),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/games/${game.id}/events/breakdown`)
      .query({ eventName: 'Pickup item', startDate: sub(new Date(), { days: 1 }), endDate: new Date() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toStrictEqual({})
  })

  it('should return event props by dev build players if the dev data header is set', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    const events = await new EventFactory([player]).state(() => ({
      name: 'Pickup item',
      createdAt: new Date(),
      props: [
        { key: 'itemId', value: '1' }
      ]
    })).many(3)
    await em.persistAndFlush(player)

    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow'
    })
    await clickhouse.insert({
      table: 'event_props',
      values: events.flatMap((event) => event.getInsertableProps()),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/games/${game.id}/events/breakdown`)
      .query({ eventName: 'Pickup item', startDate: sub(new Date(), { days: 1 }), endDate: new Date() })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.events['[itemId = 1]'][0].count).toBe(events.length)
  })

  it('should not return breakdowns for meta props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const now = new Date('2021-01-01')

    const events = await new EventFactory([player]).state((event, idx) => ({
      name: 'Pickup item',
      createdAt: addDays(now, idx),
      props: [
        { key: 'META_SCREEN_WIDTH', value: '1920' }
      ]
    })).many(2)

    await em.persistAndFlush(player)
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow'
    })
    await clickhouse.insert({
      table: 'event_props',
      values: events.flatMap((event) => event.getInsertableProps()),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/games/${game.id}/events/breakdown`)
      .query({ eventName: 'Pickup item', startDate: '2021-01-01', endDate: '2021-01-03' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(Object.keys(res.body.events)).toHaveLength(0)
  })
})
