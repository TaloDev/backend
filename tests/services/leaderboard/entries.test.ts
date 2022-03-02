import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import GameFactory from '../../fixtures/GameFactory'
import Game from '../../../src/entities/game'
import OrganisationFactory from '../../fixtures/OrganisationFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'

const baseUrl = '/leaderboards'

describe('Leaderboard service - entries', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    validGame = await new GameFactory(user.organisation).one()
    const players = await new PlayerFactory([validGame]).many(10)
    await (<EntityManager>app.context.em).persistAndFlush([user, validGame, ...players])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a leaderboard\'s entries', async () => {
    const leaderboard = await new LeaderboardFactory([validGame]).state('with entries').one()
    await (<EntityManager>app.context.em).persistAndFlush(leaderboard)

    const res = await request(app.callback())
      .get(`${baseUrl}/${leaderboard.id}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(leaderboard.entries.length)
  })

  it('should not return entries for a non-existent leaderboard', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}/21312312/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })

  it('should not return a leaderboard\'s entries for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = await new GameFactory(otherOrg).one()
    const leaderboard = await new LeaderboardFactory([otherGame]).state('with entries').one()
    await (<EntityManager>app.context.em).persistAndFlush(leaderboard)

    await request(app.callback())
      .get(`${baseUrl}/${leaderboard.id}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
