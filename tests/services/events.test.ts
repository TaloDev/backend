import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../src/index'
import request from 'supertest'
import User from '../../src/entities/user'
import { genAccessToken } from '../../src/lib/auth/buildTokenPair'
import Game from '../../src/entities/game'
import Event from '../../src/entities/event'
import Player from '../../src/entities/player'
import EventFactory from '../fixtures/EventFactory'

const baseUrl = '/events'

describe('Events service', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = new User()
    validGame = new Game('Uplift')
    validGame.teamMembers.add(user)
    await (<EntityManager>app.context.em).persistAndFlush(validGame)

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
    const player = new Player(validGame)
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

    expect(res.body.events['Open inventory']).toHaveLength(2)

    expect(res.body.events['Open inventory'][0]).toEqual({
      name: 'Open inventory',
      date: new Date(now.getTime()).getTime(),
      count: 1,
      change: 1
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

    expect(res.body.message).toBe('Missing query key: startDate')
  })

  it('should require a valid startDate query key to get events', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, startDate: '2015-02-32' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body.message).toBe('Invalid start date, please use YYYY-MM-DD or a timestamp')
  })

  it('should require a startDate that comes before the endDate query key to get events', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, startDate: '2003-02-01', endDate: '2001-01-01' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body.message).toBe('Invalid start date, it should be before the end date')
  })

  it('should require a endDate query key to get events', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, startDate: '2021-01-01' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body.message).toBe('Missing query key: endDate')
  })

  it('should require a valid endDate query key to get events', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, startDate: '2015-01-29', endDate: '2015-02-32' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body.message).toBe('Invalid end date, please use YYYY-MM-DD or a timestamp')
  })

  it('should correctly calculate event changes', async () => {
    const player = new Player(validGame)
    const now = new Date('2021-01-01')

    const dayInMs = 86400000

    const eventFactory = new EventFactory([player])
    const firstEvent: Event = await eventFactory.with((event) => ({
      name: 'Open inventory',
      createdAt: now
    })).one()

    const moreEvents: Event[] = await eventFactory.with((event) => ({
      name: 'Open inventory',
      createdAt: new Date(now.getTime() + dayInMs)
    })).many(2)

    const evenMoreEvents: Event[] = await eventFactory.with((event) => ({
      name: 'Open inventory',
      createdAt: new Date(now.getTime() + dayInMs * 2)
    })).many(3)

    const lastEvent: Event = await eventFactory.with((event) => ({
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

    expect(res.body.events['Open inventory'][0].change).toBe(1)
    expect(res.body.events['Open inventory'][1].change).toBe(1)
    expect(res.body.events['Open inventory'][2].change).toBe(0.5)
    expect(res.body.events['Open inventory'][3].change.toFixed(2)).toBe('-0.67')
  })

  it('should not return a list of events for a non-existent game', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: 99 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'The specified game doesn\'t exist' })
  })

  it('should not return a list of events for a game the user has no access to', async () => {
    const otherGame = new Game('Crawle')
    await (<EntityManager>app.context.em).persistAndFlush(otherGame)

    await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
