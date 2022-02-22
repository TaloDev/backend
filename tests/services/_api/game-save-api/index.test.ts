import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import APIKey, { APIKeyScope } from '../../../../src/entities/api-key'
import { createToken } from '../../../../src/services/api-key.service'
import UserFactory from '../../../fixtures/UserFactory'
import GameFactory from '../../../fixtures/GameFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import Player from '../../../../src/entities/player'
import GameSave from '../../../../src/entities/game-save'
import GameSaveFactory from '../../../fixtures/GameSaveFactory'

const baseUrl = '/v1/game-saves'

describe('Game save API service - index', () => {
  let app: Koa
  let apiKey: APIKey
  let token: string
  let players: Player[]
  let saves: GameSave[]

  beforeAll(async () => {
    app = await init()

    const user = await new UserFactory().one()
    const game = await new GameFactory(user.organisation).one()
    apiKey = new APIKey(game, user)

    players = await new PlayerFactory([game]).many(4)
    saves = await new GameSaveFactory(players).many(5)

    token = await createToken(apiKey)

    await (<EntityManager>app.context.em).persistAndFlush([apiKey, ...saves])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return game saves if the scope is valid', async () => {
    apiKey.scopes = [APIKeyScope.READ_GAME_SAVES]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .get(`${baseUrl}?aliasId=${saves[0].player.aliases[0].id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    const length = saves.filter((save) => save.player.id === saves[0].player.id).length
    expect(res.body.saves).toHaveLength(length)
  })

  it('should not return game saves if the scope is not valid', async () => {
    apiKey.scopes = []
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .get(`${baseUrl}?aliasId=${saves[0].player.aliases[0].id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not return game saves for a missing player', async () => {
    apiKey.scopes = [APIKeyScope.READ_GAME_SAVES]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .get(`${baseUrl}?aliasId=123456`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
