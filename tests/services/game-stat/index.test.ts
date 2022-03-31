import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import GameFactory from '../../fixtures/GameFactory'
import GameStatFactory from '../../fixtures/GameStatFactory'
import OrganisationFactory from '../../fixtures/OrganisationFactory'

const baseUrl = '/game-stats'

describe('Game stat service - index', () => {
  let app: Koa
  let user: User
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a list of game stats', async () => {
    const game = await new GameFactory(user.organisation).one()
    const stats = await new GameStatFactory([game]).many(3)
    await (<EntityManager>app.context.em).persistAndFlush([game, ...stats])

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: game.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stats).toHaveLength(stats.length)
  })

  it('should not return a list of game stats for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const game = await new GameFactory(otherOrg).one()
    const stats = await new GameStatFactory([game]).many(3)
    await (<EntityManager>app.context.em).persistAndFlush([game, ...stats])

    await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: game.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
