import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import { APIKeyScope } from '../../src/entities/api-key'
import init from '../../src/index'
import UserFactory from '../fixtures/UserFactory'
import request from 'supertest'
import { genAccessToken } from '../../src/lib/auth/buildTokenPair'
import GameFactory from '../fixtures/GameFactory'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'

describe('Policy base class', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should reject a revoked api key', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.READ_EVENTS])
    apiKey.revokedAt = new Date()
    await (<EntityManager>app.context.em).flush()

    await request(app.callback())
      .get('/v1/players/identify?service=username&identifier=')
      .query({ service: 'username', identifier: 'ionproject' })
      .auth(token, { type: 'bearer' })
      .expect(401)
  })

  it('should reject a non-existent user', async () => {
    const user = await new UserFactory().one()
    const game = await new GameFactory(user.organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush([user, game])

    const token = await genAccessToken(user)
    await (<EntityManager>app.context.em).removeAndFlush(user)

    await request(app.callback())
      .get(`/games/${game.id}/events`)
      .query({ startDate: '2021-01-01', endDate: '2021-01-02' })
      .auth(token, { type: 'bearer' })
      .expect(401)
  })
})
