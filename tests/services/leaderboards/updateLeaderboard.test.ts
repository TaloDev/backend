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
import Leaderboard, { LeaderboardSortMode } from '../../../src/entities/leaderboard'

const baseUrl = '/leaderboards'

describe('Leaderboards service - update leaderboard', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string
  let leaderboard: Leaderboard

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    validGame = await new GameFactory(user.organisation).one()
    leaderboard = await new LeaderboardFactory([validGame]).one()

    await (<EntityManager>app.context.em).persistAndFlush([user, validGame, leaderboard])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should update a leaderboard\'s name', async () => {
    const res = await request(app.callback())
      .patch(`${baseUrl}/${leaderboard.internalName}`)
      .send({ gameId: validGame.id, name: 'The new name' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.name).toBe('The new name')
  })

  it('should update a leaderboard\'s sort mode', async () => {
    leaderboard.sortMode = LeaderboardSortMode.DESC
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .patch(`${baseUrl}/${leaderboard.internalName}`)
      .send({ gameId: validGame.id, sortMode: LeaderboardSortMode.ASC })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.sortMode).toBe('asc')
  })

  it('should not update a leaderboard\'s entry uniqueness mode if the key is not sent', async () => {
    leaderboard.unique = true
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .patch(`${baseUrl}/${leaderboard.internalName}`)
      .send({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.unique).toBe(true)
  })

  it('should update a leaderboard\'s entry uniqueness mode', async () => {
    leaderboard.unique = true
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .patch(`${baseUrl}/${leaderboard.internalName}`)
      .send({ gameId: validGame.id, unique: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.unique).toBe(false)
  })

  it('should not update a non-existent leaderboard', async () => {
    const res = await request(app.callback())
      .patch(`${baseUrl}/blah`)
      .send({ gameId: validGame.id, name: 'The new name' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })
})
