import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import Game from '../../../src/entities/game'
import Event from '../../../src/entities/event'
import EventFactory from '../../fixtures/EventFactory'
import UserFactory from '../../fixtures/UserFactory'
import OrganisationFactory from '../../fixtures/OrganisationFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import { sub } from 'date-fns'

const baseUrl = '/events'

describe('Events service - get', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    validGame = new Game('Uplift', user.organisation)
    await (<EntityManager>app.context.em).persistAndFlush([user, validGame])

    token = await genAccessToken(user)
  })

  beforeEach(async () => {
    const repo = (<EntityManager>app.context.em).getRepository(Event)
    const events = await repo.findAll()
    await repo.removeAndFlush(events)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a list of events', async () => {
    const player = await new PlayerFactory([validGame]).one()
    const now = new Date('2021-01-01')

    const dayInMs = 86400000

    const events: Event[] = await new EventFactory([player]).with((event, idx) => ({
      name: 'Open inventory',
      createdAt: new Date(now.getTime() + (dayInMs * idx))
    })).many(2)

    await (<EntityManager>app.context.em).persistAndFlush(events)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, startDate: '2021-01-01', endDate: '2021-01-03' })
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
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Missing query key: startDate' })
  })

  it('should require a valid startDate query key to get events', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, startDate: '2015-02-32' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Invalid start date, please use YYYY-MM-DD or a timestamp' })
  })

  it('should require a startDate that comes before the endDate query key to get events', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, startDate: '2003-02-01', endDate: '2001-01-01' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Invalid start date, it should be before the end date' })
  })

  it('should require a endDate query key to get events', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, startDate: '2021-01-01' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Missing query key: endDate' })
  })

  it('should require a valid endDate query key to get events', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, startDate: '2015-01-29', endDate: '2015-02-32' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Invalid end date, please use YYYY-MM-DD or a timestamp' })
  })

  it('should correctly calculate event changes', async () => {
    const player = await new PlayerFactory([validGame]).one()
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

    await (<EntityManager>app.context.em).persistAndFlush([
      firstEvent,
      ...moreEvents,
      ...evenMoreEvents,
      lastEvent
    ])

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, startDate: '2021-01-01', endDate: '2021-01-05' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events['Open inventory'][0].change).toBe(0)
    expect(res.body.events['Open inventory'][1].change).toBe(1)
    expect(res.body.events['Open inventory'][2].change).toBe(0.5)
    expect(res.body.events['Open inventory'][3].change.toFixed(2)).toBe('-0.67')
  })

  it('should mark the change between 0 events and 1 event as 100%', async () => {
    const player = await new PlayerFactory([validGame]).one()
    const now = new Date('2021-01-01')

    const dayInMs = 86400000

    const eventFactory = new EventFactory([player])

    const event: Event = await eventFactory.with(() => ({
      name: 'Join guild',
      createdAt: new Date(now.getTime() + dayInMs)
    })).one()

    await (<EntityManager>app.context.em).persistAndFlush(event)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, startDate: '2021-01-01', endDate: '2021-01-05' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events['Join guild'][0].change).toBe(0)
    expect(res.body.events['Join guild'][1].change).toBe(1)
  })

  it('should not return a list of events for a non-existent game', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: 99, startDate: '2021-01-01', endDate: '2021-01-05' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return a list of events for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = new Game('Crawle', otherOrg)
    await (<EntityManager>app.context.em).persistAndFlush(otherGame)

    await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: otherGame.id, startDate: '2021-01-01', endDate: '2021-01-05' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should return events from today if the endDate is today', async () => {
    const player = await new PlayerFactory([validGame]).one()
    const events = await new EventFactory([player]).with(() => ({ name: 'Talk to NPC', createdAt: new Date() })).many(3)
    await (<EntityManager>app.context.em).persistAndFlush(events)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, startDate: sub(new Date(), { days: 1 }), endDate: new Date() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events['Talk to NPC'][1].count).toBe(3)
  })
})
