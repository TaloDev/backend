import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import APIKey, { APIKeyScope } from '../../../../src/entities/api-key'
import { createToken } from '../../../../src/services/api-keys.service'
import UserFactory from '../../../fixtures/UserFactory'
import GameFactory from '../../../fixtures/GameFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import Player from '../../../../src/entities/player'

const baseUrl = '/v1/game-saves'

describe('Game saves API service - post', () => {
  let app: Koa
  let apiKey: APIKey
  let token: string
  let players: Player[]

  beforeAll(async () => {
    app = await init()

    const user = await new UserFactory().one()
    const game = await new GameFactory(user.organisation).one()
    apiKey = new APIKey(game, user)

    players = await new PlayerFactory([game]).many(4)

    token = await createToken(apiKey)

    await (<EntityManager>app.context.em).persistAndFlush([apiKey, ...players])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a game save if the scope is valid', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_GAME_SAVES]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ name: 'save', content: {}, aliasId: players[0].aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should not create a game save if the scope is not valid', async () => {
    apiKey.scopes = []
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ name: 'save', content: {}, aliasId: players[0].aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create a game save for a missing player', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_GAME_SAVES]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ name: 'save', content: {}, aliasId: 12345 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
