import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import Game from '../../../src/entities/game'
import UserFactory from '../../fixtures/UserFactory'
import OrganisationFactory from '../../fixtures/OrganisationFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import Player from '../../../src/entities/player'

const baseUrl = '/players'

describe('Player service - index', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    validGame = new Game('Uplift', user.organisation)
    await (<EntityManager>app.context.em).persistAndFlush([user, validGame])

    token = await genAccessToken(user)
  })

  beforeEach(async () => {
    const repo = (<EntityManager>app.context.em).getRepository(Player)
    const players = await repo.findAll()
    await repo.removeAndFlush(players)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
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
      .query({ gameId: 99999 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return a list of players for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = new Game('Crawle', otherOrg)
    await (<EntityManager>app.context.em).persistAndFlush(otherGame)

    await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should filter players by props', async () => {
    const players = await new PlayerFactory([validGame]).with(() => ({
      props: [
        {
          key: 'guildName',
          value: 'The Best Guild'
        }
      ]
    })).many(2)

    const otherPlayers = await new PlayerFactory([validGame]).many(3)

    await (<EntityManager>app.context.em).persistAndFlush([...players, ...otherPlayers])

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, search: 'The Best Guild' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(2)
  })

  it('should filter players by aliases', async () => {
    const player = await new PlayerFactory([validGame]).one()
    const otherPlayers = await new PlayerFactory([validGame]).many(3)

    await (<EntityManager>app.context.em).persistAndFlush([player, ...otherPlayers])

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, search: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(1)
  })

  it('should filter players by id', async () => {
    const player = await new PlayerFactory([validGame]).with(() => ({ id: 'abc12345678' })).one()
    const otherPlayers = await new PlayerFactory([validGame]).many(3)

    await (<EntityManager>app.context.em).persistAndFlush([player, ...otherPlayers])

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, search: 'abc12345678' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(1)
  })

  it('should paginate results when getting players', async () => {
    const players = await new PlayerFactory([validGame]).many(36)
    await (<EntityManager>app.context.em).persistAndFlush(players)

    const page = Math.floor(players.length / 25)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, page })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(players.length % 25)
    expect(res.body.count).toBe(players.length)
  })

  it('should not return dev build players without the dev data header', async () => {
    const players = await new PlayerFactory([validGame]).state('dev build').many(5)
    await (<EntityManager>app.context.em).persistAndFlush(players)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return dev build players with the dev data header', async () => {
    const players = await new PlayerFactory([validGame]).state('dev build').many(5)
    await (<EntityManager>app.context.em).persistAndFlush(players)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(players.length)
  })
})
