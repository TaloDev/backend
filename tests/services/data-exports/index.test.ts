import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import Game from '../../../src/entities/game'
import GameFactory from '../../fixtures/GameFactory'
import DataExportFactory from '../../fixtures/DataExportFactory'

const baseUrl = '/data-exports'

describe('Data exports service - index', () => {
  let app: Koa
  let user: User
  let game: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('admin').one()
    game = await new GameFactory(user.organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush([user, game])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a list of data exports', async () => {
    const exports = await new DataExportFactory(game).many(5)
    await (<EntityManager>app.context.em).persistAndFlush(exports)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: game.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.dataExports).toHaveLength(exports.length)
  })

  it('should not return data exports for dev users', async () => {
    const invalidUser = await new UserFactory().with(() => ({ organisation: game.organisation })).one()
    await (<EntityManager>app.context.em).persistAndFlush(invalidUser)

    const invalidUserToken = await genAccessToken(invalidUser)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: game.id })
      .auth(invalidUserToken, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You do not have permissions to view data exports' })
  })
})
