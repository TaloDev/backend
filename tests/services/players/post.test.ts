import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import Game from '../../../src/entities/game'
import UserFactory from '../../fixtures/UserFactory'
import OrganisationFactory from '../../fixtures/OrganisationFactory'

const baseUrl = '/players'

describe('Players service - post', () => {
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

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a player', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeDefined()
  })

  it('should create a player with aliases', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({
        aliases: [{
          service: 'steam',
          identifier: '12345'
        }],
        gameId: validGame.id
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeDefined()
    expect(res.body.player.aliases).toHaveLength(1)
    expect(res.body.player.aliases[0].service).toBe('steam')
    expect(res.body.player.aliases[0].identifier).toBe('12345')
  })

  it('should create a player with props', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({
        gameId: validGame.id,
        props: [
          {
            key: 'characterName',
            value: 'Bob John'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

      expect(res.body.player.props[0].key).toBe('characterName')
      expect(res.body.player.props[0].value).toBe('Bob John')
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
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = new Game('Crawle', otherOrg)
    await (<EntityManager>app.context.em).persistAndFlush(otherGame)

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create a player if props are in the incorrect format', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({
        gameId: validGame.id,
        props: {
          characterName: 'Bob John'
        }
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

      expect(res.body.message).toBe('Props must be an array')
  })
})
