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

    apiKey = new APIKey(new Game('Uplift'), new User())
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
      .expect(403)
  })

  it('should identify a player', async () => {
    apiKey.scopes = [APIKeyScope.READ_PLAYERS]
    token = await createToken(apiKey)

    const player = new Player(apiKey.game)
    player.aliases = {
      steam: '4568382'
    }
    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .get(`${baseUrl}/identify`)
      .query({ alias: 'steam', id: '4568382' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.id).toBe(player.id)
  })

  it('should not identify a player if the scope is missing', async () => {
    apiKey.scopes = []
    token = await createToken(apiKey)

    await request(app.callback())
      .get(`${baseUrl}/identify`)
      .query({ alias: 'steam', id: '2131231' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not identify a non-existent player', async () => {
    apiKey.scopes = [APIKeyScope.READ_PLAYERS]
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .get(`${baseUrl}/identify`)
      .query({ alias: 'steam', id: '2131231' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should update a player\'s properties', async () => {
    const player = new Player(apiKey.game)
    player.props = {
      collectibles: 0,
      zonesExplored: 1
    }
    await (<EntityManager>app.context.em).persistAndFlush(player)

    apiKey.scopes = [APIKeyScope.WRITE_PLAYERS]
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${player.id}`)
      .send({
        props: {
          collectibles: 1
        }
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toStrictEqual({
      collectibles: 1,
      zonesExplored: 1
    })
  })

  it('should not update a player\'s properties if the scope is missing', async () => {
    const player = new Player(apiKey.game)
    player.props = {
      collectibles: 0,
      zonesExplored: 1
    }
    await (<EntityManager>app.context.em).persistAndFlush(player)

    apiKey.scopes = []
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${player.id}`)
      .send({
        props: {
          collectibles: 1
        }
      })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not update a non-existent player\'s properties', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_PLAYERS]
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .patch(`${baseUrl}/546`)
      .send({
        props: {
          collectibles: 1
        }
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
