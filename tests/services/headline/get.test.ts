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
import PlayerFactory from '../../fixtures/PlayerFactory'
import GameFactory from '../../fixtures/GameFactory'
import { sub, format } from 'date-fns'
import OrganisationFactory from '../../fixtures/OrganisationFactory'
import clearEntities from '../../utils/clearEntities'

describe('Headline service - get', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  const startDate = format(sub(new Date(), { days: 7 }), 'yyyy-MM-dd')
  const endDate = format(new Date(), 'yyyy-MM-dd')

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    validGame = await new GameFactory(user.organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush([user, validGame])

    token = await genAccessToken(user)
  })

  beforeEach(async () => {
    await clearEntities(app.context.em, ['PlayerProp', 'Event', 'Player'])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return the correct number of new events this week', async () => {
    const player = await new PlayerFactory([validGame]).one()
    const events: Event[] = await new EventFactory([player]).state('this week').many(10)
    await (<EntityManager>app.context.em).persistAndFlush(events)

    const res = await request(app.callback())
      .get(`/games/${validGame.id}/headlines/events`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(10)
  })

  it('should not return new events for dev build players without the dev data header', async () => {
    const player = await new PlayerFactory([validGame]).state('dev build').one()
    const events: Event[] = await new EventFactory([player]).state('this week').many(10)
    await (<EntityManager>app.context.em).persistAndFlush(events)

    const res = await request(app.callback())
      .get(`/games/${validGame.id}/headlines/events`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return new events for dev build players with the dev data header', async () => {
    const player = await new PlayerFactory([validGame]).state('dev build').one()
    const events: Event[] = await new EventFactory([player]).state('this week').many(10)
    await (<EntityManager>app.context.em).persistAndFlush(events)

    const res = await request(app.callback())
      .get(`/games/${validGame.id}/headlines/events`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(10)
  })

  it('should return the correct number of new players this week', async () => {
    const newPlayers = await new PlayerFactory([validGame]).state('created this week').many(10)
    const oldPlayers = await new PlayerFactory([validGame]).state('not created this week').many(10)

    await (<EntityManager>app.context.em).persistAndFlush([...newPlayers, ...oldPlayers])

    const res = await request(app.callback())
      .get(`/games/${validGame.id}/headlines/new_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(10)
  })

  it('should not return new dev build players without the dev data header', async () => {
    const newPlayers = await new PlayerFactory([validGame]).state('created this week').state('dev build').many(10)

    await (<EntityManager>app.context.em).persistAndFlush(newPlayers)

    const res = await request(app.callback())
      .get(`/games/${validGame.id}/headlines/new_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return new dev build players with the dev data header', async () => {
    const newPlayers = await new PlayerFactory([validGame]).state('created this week').state('dev build').many(10)

    await (<EntityManager>app.context.em).persistAndFlush(newPlayers)

    const res = await request(app.callback())
      .get(`/games/${validGame.id}/headlines/new_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(10)
  })

  it('should return the correct number of returning players this week', async () => {
    const playersNotSeenThisWeek = await new PlayerFactory([validGame]).state('not seen this week').many(6)

    const returningPlayersSeenThisWeek = await new PlayerFactory([validGame])
      .state('seen this week')
      .state('not created this week')
      .many(4)

    const playersSignedupThisWeek = await new PlayerFactory([validGame]).state('created this week').many(5)

    await (<EntityManager>app.context.em).persistAndFlush([...playersNotSeenThisWeek, ...returningPlayersSeenThisWeek, ...playersSignedupThisWeek])

    const res = await request(app.callback())
      .get(`/games/${validGame.id}/headlines/returning_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(4)
  })

  it('should not return returning dev build players without the dev data header', async () => {
    const returningPlayersSeenThisWeek = await new PlayerFactory([validGame])
      .state('seen this week')
      .state('not created this week')
      .state('dev build')
      .many(4)

    await (<EntityManager>app.context.em).persistAndFlush(returningPlayersSeenThisWeek)

    const res = await request(app.callback())
      .get(`/games/${validGame.id}/headlines/returning_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return returning dev build players with the dev data header', async () => {
    const returningPlayersSeenThisWeek = await new PlayerFactory([validGame])
      .state('seen this week')
      .state('not created this week')
      .state('dev build')
      .many(4)

    await (<EntityManager>app.context.em).persistAndFlush(returningPlayersSeenThisWeek)

    const res = await request(app.callback())
      .get(`/games/${validGame.id}/headlines/returning_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(4)
  })

  it('should return the correct number of unique event submitters', async () => {
    const players = await new PlayerFactory([validGame]).many(4)
    const validEvents = await new EventFactory([players[0]]).many(3)
    const validEventsButNotThisWeek = await new EventFactory([players[1]]).with(() => ({
      createdAt: sub(new Date(), { weeks: 2 })
    })).many(3)
    const moreValidEvents = await new EventFactory([players[2]]).many(3)

    await (<EntityManager>app.context.em).persistAndFlush([
      ...validEvents,
      ...validEventsButNotThisWeek,
      ...moreValidEvents
    ])

    const res = await request(app.callback())
      .get(`/games/${validGame.id}/headlines/unique_event_submitters`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(2)
  })

  it('should not return dev build unique event submitters without the dev data header', async () => {
    const player = await new PlayerFactory([validGame]).state('dev build').one()
    const validEvents = await new EventFactory([player]).many(3)

    await (<EntityManager>app.context.em).persistAndFlush(validEvents)

    const res = await request(app.callback())
      .get(`/games/${validGame.id}/headlines/unique_event_submitters`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return dev build unique event submitters with the dev data header', async () => {
    const player = await new PlayerFactory([validGame]).state('dev build').one()
    const validEvents = await new EventFactory([player]).many(3)

    await (<EntityManager>app.context.em).persistAndFlush(validEvents)

    const res = await request(app.callback())
      .get(`/games/${validGame.id}/headlines/unique_event_submitters`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(1)
  })

  it('should not return headlines for a game the user cant access', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = new Game('Crawle', otherOrg)
    await (<EntityManager>app.context.em).persistAndFlush(otherGame)

    await request(app.callback())
      .get(`/games/${otherGame.id}/headlines/new_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
