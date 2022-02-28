import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import APIKey, { APIKeyScope } from '../../../../src/entities/api-key'
import { createToken } from '../../../../src/services/api-key.service'
import UserFactory from '../../../fixtures/UserFactory'
import GameFactory from '../../../fixtures/GameFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameSave from '../../../../src/entities/game-save'
import GameSaveFactory from '../../../fixtures/GameSaveFactory'

const baseUrl = '/v1/game-saves'

describe('Game save API service - patch', () => {
  let app: Koa
  let apiKey: APIKey
  let token: string
  let save: GameSave

  beforeAll(async () => {
    app = await init()

    const user = await new UserFactory().one()
    const game = await new GameFactory(user.organisation).one()
    apiKey = new APIKey(game, user)

    const player = await new PlayerFactory([game]).one()
    save = await new GameSaveFactory([player]).one()

    token = await createToken(apiKey)

    await (<EntityManager>app.context.em).persistAndFlush([apiKey, save])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should update a game save if the scope is valid', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_GAME_SAVES]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${save.id}`)
      .send({ content: { progress: 10 }, aliasId: save.player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.save.content).toStrictEqual({
      progress: 10
    })
  })

  it('should update the game save name if the key exists', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_GAME_SAVES]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${save.id}`)
      .send({ content: { progress: 10 }, name: 'New save name', aliasId: save.player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.save.name).toBe('New save name')
  })

  it('should not update a game save if the scope is not valid', async () => {
    apiKey.scopes = []
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .patch(`${baseUrl}/${save.id}`)
      .send({ content: { progress: 10 }, aliasId: save.player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not update another player\'s save', async () => {
    const otherPlayer = await new PlayerFactory([save.player.game]).one()
    const otherSave = await new GameSaveFactory([otherPlayer]).one()

    apiKey.scopes = [APIKeyScope.WRITE_GAME_SAVES]
    await (<EntityManager>app.context.em).persistAndFlush(otherSave)
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${otherSave.id}`)
      .send({ content: { progress: 10 }, aliasId: save.player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Save not found' })
  })
})
