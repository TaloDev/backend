import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameSaveFactory from '../../../fixtures/GameSaveFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'

const baseUrl = '/v1/game-saves'

describe('Game save API service - index', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return game saves if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.READ_GAME_SAVES])
    const players = await new PlayerFactory([apiKey.game]).many(4)
    const saves = await new GameSaveFactory(players).many(5)
    await (<EntityManager>app.context.em).persistAndFlush(saves)

    const res = await request(app.callback())
      .get(baseUrl)
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', saves[0].player.id)
      .expect(200)

    const length = saves.filter((save) => save.player.id === saves[0].player.id).length
    expect(res.body.saves).toHaveLength(length)
  })

  it('should not return game saves if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [])
    const players = await new PlayerFactory([apiKey.game]).many(4)
    const saves = await new GameSaveFactory(players).many(5)
    await (<EntityManager>app.context.em).persistAndFlush(saves)

    await request(app.callback())
      .get(baseUrl)
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', saves[0].player.id)
      .expect(403)
  })

  it('should not return game saves for a missing player', async () => {
    const [, token] = await createAPIKeyAndToken(app.context.em, [])

    const res = await request(app.callback())
      .get(baseUrl)
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', '123456')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not return game saves for a player from another game', async () => {
    const [, token] = await createAPIKeyAndToken(app.context.em, [])
    const [, game] = await createOrganisationAndGame(app.context.em)
    const otherPlayer = await new PlayerFactory([game]).one()

    await (<EntityManager>app.context.em).persistAndFlush(otherPlayer)

    const res = await request(app.callback())
      .post(baseUrl)
      .send({ name: 'save', content: {} })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', otherPlayer.id)
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
