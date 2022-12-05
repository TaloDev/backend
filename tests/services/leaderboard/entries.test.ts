import { EntityManager } from '@mikro-orm/core'
import request from 'supertest'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import LeaderboardEntryFactory from '../../fixtures/LeaderboardEntryFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'

describe('Leaderboard service - entries', () => {
  it('should return a leaderboard\'s entries', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const players = await new PlayerFactory([game]).many(10)
    await (<EntityManager>global.em).persist(players)

    const leaderboard = await new LeaderboardFactory([game]).state('with entries').one()
    await (<EntityManager>global.em).persistAndFlush(leaderboard)

    const res = await request(global.app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(leaderboard.entries.length)
  })

  it('should not return entries for a non-existent leaderboard', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/leaderboards/21312312/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })

  it('should not return a leaderboard\'s entries for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const leaderboard = await new LeaderboardFactory([game]).state('with entries').one()
    await (<EntityManager>global.em).persistAndFlush(leaderboard)

    await request(global.app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should correctly mark the last page', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const players = await new PlayerFactory([game]).many(10)
    await (<EntityManager>global.em).persist(players)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const entries = await new LeaderboardEntryFactory(leaderboard, game.players.getItems()).many(106)
    await (<EntityManager>global.em).persistAndFlush([leaderboard, ...entries])

    for (let i = 0; i < 3; i++) {
      const res = await request(global.app)
        .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
        .query({ page: i })
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res.body.entries).toHaveLength(i === 2 ? 6 : 50)
      expect(res.body.count).toBe(106)
      expect(res.body.isLastPage).toBe(i === 2 ? true : false)
    }
  })

  it('should not return leaderboard entries for dev build players without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).state('with entries').state('dev build players').one()
    await (<EntityManager>global.em).persistAndFlush(leaderboard)

    const res = await request(global.app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(0)
  })

  it('should return leaderboard entries for dev build players with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).state('with entries').state('dev build players').one()
    await (<EntityManager>global.em).persistAndFlush(leaderboard)

    const res = await request(global.app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.entries).toHaveLength(leaderboard.entries.length)
  })
})
