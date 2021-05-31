import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import Game from '../../../src/entities/game'
import UserFactory from '../../fixtures/UserFactory'
import OrganisationFactory from '../../fixtures/OrganisationFactory'

const baseUrl = '/api-keys'

describe('API keys service - post', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('admin').one()
    validGame = new Game('Uplift', user.organisation)
    await (<EntityManager>app.context.em).persistAndFlush([user, validGame])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should not create an api key if the user\'s email is not confirmed', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: validGame.id, scopes: ['read:players', 'write:events'] })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You need to confirm your email address to do this' })
  })

  it('should create an api key if the user\'s email is confirmed', async () => {
    user.emailConfirmed = true
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: validGame.id, scopes: ['read:players', 'write:events'] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.apiKey.gameId).toBe(validGame.id)
    expect(res.body.apiKey.scopes).toStrictEqual(['read:players', 'write:events'])
  })

  it('should not create an api key for a non-existent game', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: 99 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'The specified game doesn\'t exist' })
  })

  it('should not create an api key for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = new Game('Crawle', otherOrg)
    await (<EntityManager>app.context.em).persistAndFlush(otherGame)

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create an api key if the user is not an admin', async () => {
    const invalidUser = await new UserFactory().one()
    await (<EntityManager>app.context.em).persistAndFlush(invalidUser)

    const invalidUserToken = await genAccessToken(invalidUser)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: validGame.id, scopes: ['read:players', 'write:events'] })
      .auth(invalidUserToken, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You do not have permissions to manage API keys' })
  })
})
