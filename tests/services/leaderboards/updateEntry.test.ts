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
import PlayerFactory from '../../fixtures/PlayerFactory'
import Leaderboard from '../../../src/entities/leaderboard'

const baseUrl = '/leaderboards'

describe('Leaderboards service - update entry', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string
  let leaderboard: Leaderboard

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    validGame = await new GameFactory(user.organisation).one()
    const players = await new PlayerFactory([validGame]).many(10)
    leaderboard = await new LeaderboardFactory([validGame]).one()

    await (<EntityManager>app.context.em).persistAndFlush([user, validGame, ...players, leaderboard])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should mark a leaderboard entry as hidden', async () => {
    const res = await request(app.callback())
      .patch(`${baseUrl}/${leaderboard.internalName}/entries/${leaderboard.entries[0].id}`)
      .send({ gameId: validGame.id, hidden: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entry.hidden).toBe(true)
  })

  it('should not mark an entry as unhidden if the hidden property isn\'t sent', async () => {
    leaderboard.entries[0].hidden = true
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .patch(`${baseUrl}/${leaderboard.internalName}/entries/${leaderboard.entries[0].id}`)
      .send({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entry.hidden).toBe(true)
  })

  it('should not update a non-existent entry', async () => {
    const res = await request(app.callback())
      .patch(`${baseUrl}/${leaderboard.internalName}/entries/12312321`)
      .send({ gameId: validGame.id, hidden: true })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard entry not found' })
  })
})
