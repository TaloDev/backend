import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../src/index'
import request from 'supertest'
import User from '../../src/entities/user'
import { genAccessToken } from '../../src/lib/auth/buildTokenPair'
import Game from '../../src/entities/game'
import Event from '../../src/entities/event'
import Player from '../../src/entities/player'
import APIKey, { APIKeyScope } from '../../src/entities/api-key'

const baseUrl = '/api-keys'

describe('API keys service', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = new User()
    validGame = new Game('Uplift')
    validGame.teamMembers.add(user)
    await (<EntityManager>app.context.em).persistAndFlush(validGame)

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a list of api key scopes', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}/scopes`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    const length = Object.keys(res.body.scopes).reduce((acc, cur) => {
      return acc + res.body.scopes[cur].length
    }, 0)
    expect(length).toBe(Object.keys(APIKeyScope).length)
  })

  it('should return a list of api keys', async () => {
    const keys: APIKey[] = [...new Array(3)].map(() => new APIKey(validGame, user))
    await (<EntityManager>app.context.em).persistAndFlush(keys)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.apiKeys).toHaveLength(keys.length)
  })

  it('should not return a list of api keys for a non-existent game', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: 99 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'The specified game doesn\'t exist' })
  })

  it('should not return a list of api keys for a game the user has no access to', async () => {
    const otherGame = new Game('Crawle')
    await (<EntityManager>app.context.em).persistAndFlush(otherGame)

    await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should create an api key', async () => {
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
    const otherGame = new Game('Crawle')
    await (<EntityManager>app.context.em).persistAndFlush(otherGame)

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should delete an api key', async () => {
    const key = new APIKey(validGame, user)
    await (<EntityManager>app.context.em).persistAndFlush(key)

    await request(app.callback())
      .delete(`${baseUrl}/${key.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    await (<EntityManager>app.context.em).clear()
    const updatedKey = await (<EntityManager>app.context.em).getRepository(APIKey).findOne(key.id)

    expect(updatedKey.revokedAt).toBeTruthy()
  })

  it('should not delete an api key that doesn\'t exist', async () => {
    const res = await request(app.callback())
      .delete(`${baseUrl}/99`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'API key not found' })
  })

  it('should not delete an api key for a game the user has no access to', async () => {
    const key = new APIKey(new Game('Crawle'), new User())
    await (<EntityManager>app.context.em).persistAndFlush(key)

    await request(app.callback())
      .delete(`${baseUrl}/${key.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})