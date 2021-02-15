import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../src/index'
import request from 'supertest'
import User from '../../src/entities/user'
import { genAccessToken } from '../../src/lib/auth/buildTokenPair'
import Game from '../../src/entities/game'

const baseUrl = '/players'

describe('Players service', () => {
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

  it('should create a player', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({
        gameId: validGame.id
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeDefined()
  })

  it('should create a player with aliases', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({
        aliases: {
          steam: '12345'
        },
        gameId: validGame.id
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeDefined()
    expect(res.body.player.aliases).toStrictEqual({ steam: '12345' })
  })

  it('should not create a player for a non-existent game', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: 99 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'The specified game doesn\'t exist' })
  })

  it('should not create a player for a game the user has no access to', async () => {
    const otherGame = new Game('Crawle')
    await (<EntityManager>app.context.em).persistAndFlush(otherGame)

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should return a list of players', async () => {
    const num = await validGame.players.loadCount()

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(num)
  })

  it('should not return a list of players for a non-existent game', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: 99 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'The specified game doesn\'t exist' })
  })

  it('should not return a list of players for a game the user has no access to', async () => {
    const otherGame = new Game('Crawle')
    await (<EntityManager>app.context.em).persistAndFlush(otherGame)

    await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
