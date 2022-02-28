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

describe('Leaderboard service - get', () => {
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

  it('should return a leaderboard', async () => {
    const leaderboard = await new LeaderboardFactory([validGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush(leaderboard)

    const res = await request(app.callback())
      .get(`${baseUrl}/${leaderboard.internalName}`)
      .query({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.id).toBe(leaderboard.id)
  })

  it('should not return a non-existent leaderboard', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}/blah`)
      .query({ gameId: 99 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })

  it('should not return a leaderboard for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = await new GameFactory(otherOrg).one()
    const leaderboard = await new LeaderboardFactory([otherGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush(leaderboard)

    await request(app.callback())
      .get(`${baseUrl}/${leaderboard.internalName}`)
      .query({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not return a leaderboard with the same name as a valid leaderboard for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = await new GameFactory(otherOrg).one()
    const validLeaderboard = await new LeaderboardFactory([validGame]).with(() => ({ internalName: 'points' })).one()
    const otherLeaderboard = await new LeaderboardFactory([otherGame]).with(() => ({ internalName: 'points' })).one()
    await (<EntityManager>app.context.em).persistAndFlush([validLeaderboard, otherLeaderboard])

    const res = await request(app.callback())
      .get(`${baseUrl}/${validLeaderboard.internalName}`)
      .query({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.id).toBe(validLeaderboard.id)

    await request(app.callback())
      .get(`${baseUrl}/${validLeaderboard.internalName}`)
      .query({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
