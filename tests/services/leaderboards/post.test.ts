import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import GameFactory from '../../fixtures/GameFactory'
import Game from '../../../src/entities/game'
import OrganisationFactory from '../../fixtures/OrganisationFactory'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import Leaderboard from '../../../src/entities/leaderboard'

const baseUrl = '/leaderboards'

describe('Leaderboards service - post', () => {
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

  beforeEach(async () => {
    const repo = (<EntityManager>app.context.em).getRepository(Leaderboard)
    const leaderboards = await repo.findAll()
    await repo.removeAndFlush(leaderboards)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a leaderboard', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: validGame.id, internalName: 'highscores', name: 'Highscores', sortMode: 'desc' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.internalName).toBe('highscores')
    expect(res.body.leaderboard.name).toBe('Highscores')
    expect(res.body.leaderboard.sortMode).toBe('desc')
  })

  it('should not create a leaderboard for demo users', async () => {
    const invalidUser = await new UserFactory().state('demo').with(() => ({ organisation: validGame.organisation })).one()
    await (<EntityManager>app.context.em).persistAndFlush(invalidUser)

    const invalidUserToken = await genAccessToken(invalidUser)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: validGame.id, internalName: 'highscores', name: 'Highscores', sortMode: 'desc' })
      .auth(invalidUserToken, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toBe('Demo accounts cannot create leaderboards')
  })

  it('should not create a leaderboard for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = await new GameFactory(otherOrg).one()
    await (<EntityManager>app.context.em).persistAndFlush([otherOrg, otherGame])

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: otherGame.id, internalName: 'highscores', name: 'Highscores', sortMode: 'desc' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create a leaderboard for a non-existent game', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: 99, internalName: 'highscores', name: 'Highscores', sortMode: 'desc' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'The specified game doesn\'t exist' })
  })

  it('should not create a leaderboard with an invalid sort mode', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: validGame.id, internalName: 'highscores', name: 'Highscores', sortMode: 'blah' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Sort mode must be one of desc, asc' })
  })

  it('should not create a leaderboard with a duplicate internal name', async () => {
    const leaderboard = await new LeaderboardFactory([validGame]).with(() => ({ internalName: 'highscores' })).one()
    await (<EntityManager>app.context.em).persistAndFlush(leaderboard)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: validGame.id, internalName: 'highscores', name: 'Highscores', sortMode: 'blah' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'A leaderboard with the internalName highscores already exists' })
  })
})
