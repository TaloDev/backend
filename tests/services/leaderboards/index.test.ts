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

const baseUrl = '/leaderboards'

describe('Leaderboards service - index', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    validGame = await new GameFactory(user.organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush([user, validGame])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a list of leaderboards', async () => {
    const leaderboards = await new LeaderboardFactory([validGame]).many(3)
    await (<EntityManager>app.context.em).persistAndFlush(leaderboards)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    res.body.leaderboards.forEach((leaderboard, idx) => {
      expect(leaderboard.id).toBe(leaderboards[idx].id)
    })
  })

  it('should not return leaderboards for a non-existent game', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: 99 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'The specified game doesn\'t exist' })
  })

  it('should not return leaderboards for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = await new GameFactory(otherOrg).one()
    const leaderboards = await new LeaderboardFactory([otherGame]).many(3)
    await (<EntityManager>app.context.em).persistAndFlush(leaderboards)

    await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
