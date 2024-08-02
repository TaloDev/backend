import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import Event from '../../../src/entities/event'
import EventFactory from '../../fixtures/EventFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import { sub, format } from 'date-fns'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'

describe('Headline service - get', () => {
  const startDate = format(sub(new Date(), { days: 7 }), 'yyyy-MM-dd')
  const endDate = format(new Date(), 'yyyy-MM-dd')

  it('should return the correct number of new events this week', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const events: Event[] = await new EventFactory([player]).thisWeek().many(10)
    await (<EntityManager>global.em).persistAndFlush(events)

    const res = await request(global.app)
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
    const events: Event[] = await new EventFactory([player]).thisWeek().many(10)
    await (<EntityManager>global.em).persistAndFlush(events)

    const res = await request(global.app)
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
    const events: Event[] = await new EventFactory([player]).thisWeek().many(10)
    await (<EntityManager>global.em).persistAndFlush(events)

    const res = await request(global.app)
      .get(`/games/${game.id}/headlines/events`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(10)
  })

  it('should return the correct number of new players this week', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const newPlayers = await new PlayerFactory([game]).createdThisWeek().many(10)
    const oldPlayers = await new PlayerFactory([game]).notCreatedThisWeek().many(10)

    await (<EntityManager>global.em).persistAndFlush([...newPlayers, ...oldPlayers])

    const res = await request(global.app)
      .get(`/games/${game.id}/headlines/new_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(10)
  })

  it('should not return new dev build players without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const newPlayers = await new PlayerFactory([game]).createdThisWeek().devBuild().many(10)

    await (<EntityManager>global.em).persistAndFlush(newPlayers)

    const res = await request(global.app)
      .get(`/games/${game.id}/headlines/new_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return new dev build players with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const newPlayers = await new PlayerFactory([game]).createdThisWeek().devBuild().many(10)

    await (<EntityManager>global.em).persistAndFlush(newPlayers)

    const res = await request(global.app)
      .get(`/games/${game.id}/headlines/new_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(10)
  })

  it('should return the correct number of returning players this week', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const playersNotSeenThisWeek = await new PlayerFactory([game]).notSeenThisWeek().many(6)

    const returningPlayersSeenThisWeek = await new PlayerFactory([game])
      .seenThisWeek()
      .notCreatedThisWeek()
      .many(4)

    const playersSignedupThisWeek = await new PlayerFactory([game]).notSeenThisWeek().many(5)

    await (<EntityManager>global.em).persistAndFlush([...playersNotSeenThisWeek, ...returningPlayersSeenThisWeek, ...playersSignedupThisWeek])

    const res = await request(global.app)
      .get(`/games/${game.id}/headlines/returning_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(4)
  })

  it('should not return returning dev build players without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const returningPlayersSeenThisWeek = await new PlayerFactory([game])
      .seenThisWeek()
      .notCreatedThisWeek()
      .devBuild()
      .many(4)

    await (<EntityManager>global.em).persistAndFlush(returningPlayersSeenThisWeek)

    const res = await request(global.app)
      .get(`/games/${game.id}/headlines/returning_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return returning dev build players with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const returningPlayersSeenThisWeek = await new PlayerFactory([game])
      .seenThisWeek()
      .notCreatedThisWeek()
      .devBuild()
      .many(4)

    await (<EntityManager>global.em).persistAndFlush(returningPlayersSeenThisWeek)

    const res = await request(global.app)
      .get(`/games/${game.id}/headlines/returning_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(4)
  })

  it('should return the correct number of unique event submitters', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const players = await new PlayerFactory([game]).many(4)
    const validEvents = await new EventFactory([players[0]]).many(3)
    const validEventsButNotThisWeek = await new EventFactory([players[1]]).state(() => ({
      createdAt: sub(new Date(), { weeks: 2 })
    })).many(3)
    const moreValidEvents = await new EventFactory([players[2]]).many(3)

    await (<EntityManager>global.em).persistAndFlush([
      ...validEvents,
      ...validEventsButNotThisWeek,
      ...moreValidEvents
    ])

    const res = await request(global.app)
      .get(`/games/${game.id}/headlines/unique_event_submitters`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(2)
  })

  it('should not return dev build unique event submitters without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    const validEvents = await new EventFactory([player]).many(3)

    await (<EntityManager>global.em).persistAndFlush(validEvents)

    const res = await request(global.app)
      .get(`/games/${game.id}/headlines/unique_event_submitters`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return dev build unique event submitters with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    const validEvents = await new EventFactory([player]).many(3)

    await (<EntityManager>global.em).persistAndFlush(validEvents)

    const res = await request(global.app)
      .get(`/games/${game.id}/headlines/unique_event_submitters`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(1)
  })

  it('should not return headlines for a game the user cant access', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({})

    await request(global.app)
      .get(`/games/${game.id}/headlines/new_players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
