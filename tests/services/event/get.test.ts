import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import Event from '../../../src/entities/event.js'
import EventFactory from '../../fixtures/EventFactory.js'
import PlayerFactory from '../../fixtures/PlayerFactory.js'
import { sub } from 'date-fns'
import createUserAndToken from '../../utils/createUserAndToken.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'

describe('Event service - get', () => {
  it('should return a list of events', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const now = new Date('2021-01-01')

    const dayInMs = 86400000

    const events: Event[] = await new EventFactory([player]).with((event, idx) => ({
      name: 'Open inventory',
      createdAt: new Date(now.getTime() + (dayInMs * idx))
    })).many(2)

    await (<EntityManager>global.em).persistAndFlush(events)

    const res = await request(global.app)
      .get(`/games/${game.id}/events`)
      .query({ startDate: '2021-01-01', endDate: '2021-01-03' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events['Open inventory']).toHaveLength(3)

    expect(res.body.events['Open inventory'][0]).toEqual({
      name: 'Open inventory',
      date: new Date(now.getTime()).getTime(),
      count: 1,
      change: 0
    })

    expect(res.body.events['Open inventory'][1]).toEqual({
      name: 'Open inventory',
      date: new Date(now.getTime() + dayInMs).getTime(),
      count: 1,
      change: 0
    })
  })

  it('should require a startDate query key to get events', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/events`)
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        endDate: ['endDate is missing from the request query'],
        startDate: ['startDate is missing from the request query']
      }
    })
  })

  it('should require a valid startDate query key to get events', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/events`)
      .query({ startDate: '2015-02-32', endDate: '2015-03-01' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        startDate: ['Invalid start date, please use YYYY-MM-DD or a timestamp']
      }
    })
  })

  it('should require a startDate that comes before the endDate query key to get events', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/events`)
      .query({ startDate: '2003-02-01', endDate: '2001-01-01' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        startDate: ['Invalid start date, it should be before the end date']
      }
    })
  })

  it('should require a endDate query key to get events', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/events`)
      .query({ startDate: '2021-01-01' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        endDate: ['endDate is missing from the request query']
      }
    })
  })

  it('should require a valid endDate query key to get events', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/events`)
      .query({ startDate: '2015-01-29', endDate: '2015-02-32' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        endDate: ['Invalid end date, please use YYYY-MM-DD or a timestamp']
      }
    })
  })

  it('should correctly calculate event changes', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const now = new Date('2021-01-01')

    const dayInMs = 86400000

    const eventFactory = new EventFactory([player])
    const firstEvent: Event = await eventFactory.with(() => ({
      name: 'Open inventory',
      createdAt: now
    })).one()

    const moreEvents: Event[] = await eventFactory.with(() => ({
      name: 'Open inventory',
      createdAt: new Date(now.getTime() + dayInMs)
    })).many(2)

    const evenMoreEvents: Event[] = await eventFactory.with(() => ({
      name: 'Open inventory',
      createdAt: new Date(now.getTime() + dayInMs * 2)
    })).many(3)

    const lastEvent: Event = await eventFactory.with(() => ({
      name: 'Open inventory',
      createdAt: new Date(now.getTime() + dayInMs * 3)
    })).one()

    await (<EntityManager>global.em).persistAndFlush([
      firstEvent,
      ...moreEvents,
      ...evenMoreEvents,
      lastEvent
    ])

    const res = await request(global.app)
      .get(`/games/${game.id}/events`)
      .query({ startDate: '2021-01-01', endDate: '2021-01-05' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events['Open inventory'][0].change).toBe(0)
    expect(res.body.events['Open inventory'][1].change).toBe(1)
    expect(res.body.events['Open inventory'][2].change).toBe(0.5)
    expect(res.body.events['Open inventory'][3].change.toFixed(2)).toBe('-0.67')
  })

  it('should mark the change between 0 events and 1 event as 100%', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const now = new Date('2021-01-01')

    const dayInMs = 86400000

    const eventFactory = new EventFactory([player])

    const event: Event = await eventFactory.with(() => ({
      name: 'Join guild',
      createdAt: new Date(now.getTime() + dayInMs)
    })).one()

    await (<EntityManager>global.em).persistAndFlush(event)

    const res = await request(global.app)
      .get(`/games/${game.id}/events`)
      .query({ startDate: '2021-01-01', endDate: '2021-01-05' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events['Join guild'][0].change).toBe(0)
    expect(res.body.events['Join guild'][1].change).toBe(1)
  })

  it('should not return a list of events for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(global.app)
      .get('/games/99999/events')
      .query({ startDate: '2021-01-01', endDate: '2021-01-05' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return a list of events for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(global.app)
      .get(`/games/${game.id}/events`)
      .query({ startDate: '2021-01-01', endDate: '2021-01-05' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should return events from today if the endDate is today', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const events = await new EventFactory([player]).with(() => ({ name: 'Talk to NPC', createdAt: new Date() })).many(3)
    await (<EntityManager>global.em).persistAndFlush(events)

    const res = await request(global.app)
      .get(`/games/${game.id}/events`)
      .query({ startDate: sub(new Date(), { days: 1 }), endDate: new Date() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events['Talk to NPC'][1].count).toBe(events.length)
  })

  it('should not return events by dev build players if the dev data header is not set', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).state('dev build').one()
    const events = await new EventFactory([player]).with(() => ({ name: 'Talk to NPC', createdAt: new Date() })).many(3)
    await (<EntityManager>global.em).persistAndFlush(events)

    const res = await request(global.app)
      .get(`/games/${game.id}/events`)
      .query({ startDate: sub(new Date(), { days: 1 }), endDate: new Date() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toStrictEqual({})
  })

  it('should return events by dev build players if the dev data header is set', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).state('dev build').one()
    const events = await new EventFactory([player]).with(() => ({ name: 'Talk to NPC', createdAt: new Date() })).many(3)
    await (<EntityManager>global.em).persistAndFlush(events)

    const res = await request(global.app)
      .get(`/games/${game.id}/events`)
      .query({ startDate: sub(new Date(), { days: 1 }), endDate: new Date() })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.events['Talk to NPC'][1].count).toBe(events.length)
  })
})
