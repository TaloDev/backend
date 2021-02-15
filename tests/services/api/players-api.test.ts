import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import Player from '../../../src/entities/player'
import Game from '../../../src/entities/game'
import APIKey, { APIKeyScope } from '../../../src/entities/api-key'
import User from '../../../src/entities/user'
import { createToken } from '../../../src/services/api-keys.service'

const baseUrl = '/api/players'

describe('Players API service', () => {
  let app: Koa
  let apiKey: APIKey
  let token: string

  beforeAll(async () => {
    app = await init()

    apiKey = new APIKey()
    apiKey.game = new Game('Uplift')
    apiKey.createdByUser = new User()
    token = await createToken(apiKey)

    await (<EntityManager>app.context.em).persistAndFlush(apiKey)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return the game\'s players if the scope is valid', async () => {
    const players: Player[] = [...new Array(3)].map(() => new Player(apiKey.game))
    await (<EntityManager>app.context.em).persistAndFlush(players)

    apiKey.scopes = [APIKeyScope.READ_PLAYERS]
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(3)

    for (let player of res.body.players) {
      expect(player.gameId).toBe(apiKey.game.id)
    }
  })

  it('should not return the game\'s players without the valid scope', async () => {
    apiKey.scopes = []
    token = await createToken(apiKey)

    await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should create a player if the scope is valid', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_PLAYERS]
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.gameId).toBe(apiKey.game.id)
  })

  it('should not create a player if the scope is valid', async () => {
    apiKey.scopes = []
    token = await createToken(apiKey)

    await request(app.callback())
      .post(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .send()
      .expect(403)
  })
})
