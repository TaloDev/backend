import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import APIKey, { APIKeyScope } from '../../../src/entities/api-key'
import Game from '../../../src/entities/game'
import init from '../../../src/index'
import { createToken } from '../../../src/services/api-keys.service'
import UserFactory from '../../fixtures/UserFactory'
import request from 'supertest'

describe('Policy base class', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should reject a revoked api key', async () => {
    const user = await new UserFactory().one()
    const apiKey = new APIKey(new Game('Uplift', user.organisation), user)
    apiKey.scopes = [APIKeyScope.READ_EVENTS]
    apiKey.revokedAt = new Date()
    await (<EntityManager>app.context.em).persistAndFlush(apiKey)

    const token = await createToken(apiKey)
    await request(app.callback())
      .get('/api/events')
      .query({ startDate: '2021-01-01', endDate: '2021-01-02' })
      .auth(token, { type: 'bearer' })
      .expect(401)
  })
})