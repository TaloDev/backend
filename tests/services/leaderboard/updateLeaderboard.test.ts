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
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'

describe('Leaderboard service - update leaderboard', () => {
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
      .put(`/games/${validGame.id}/leaderboards/${leaderboard.id}`)
      .send({ name: 'The new name', internalName: leaderboard.internalName, sortMode: leaderboard.sortMode, unique: leaderboard.unique })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.name).toBe('The new name')

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_UPDATED,
      extra: {
        leaderboardInternalName: res.body.leaderboard.internalName
      }
    })

    expect(activity).not.toBeNull()
  })

  it('should update a leaderboard\'s sort mode', async () => {
    leaderboard.sortMode = LeaderboardSortMode.DESC
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .put(`/games/${validGame.id}/leaderboards/${leaderboard.id}`)
      .send({ sortMode: LeaderboardSortMode.ASC, internalName: leaderboard.internalName, name: leaderboard.name, unique: leaderboard.unique })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.sortMode).toBe('asc')
  })

  it('should update a leaderboard\'s entry uniqueness mode', async () => {
    leaderboard.unique = true
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .put(`/games/${validGame.id}/leaderboards/${leaderboard.id}`)
      .send({ unique: false, internalName: leaderboard.internalName, name: leaderboard.name, sortMode: leaderboard.sortMode })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.unique).toBe(false)
  })

  it('should not update a non-existent leaderboard', async () => {
    const res = await request(app.callback())
      .put(`/games/${validGame.id}/leaderboards/21312321`)
      .send({ internalName: 'this-does-not-exist', name: leaderboard.name, sortMode: leaderboard.sortMode, unique: leaderboard.unique })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })
})
