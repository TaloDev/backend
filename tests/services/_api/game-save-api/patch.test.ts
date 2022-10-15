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

describe('Game save API service - patch', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should update a game save if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).one()
    const save = await new GameSaveFactory([player]).one()
    await (<EntityManager>app.context.em).persistAndFlush(save)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${save.id}`)
      .send({ content: { progress: 10 } })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', save.player.id)
      .expect(200)

    expect(res.body.save.content).toStrictEqual({
      progress: 10
    })
  })

  it('should update the game save name if the key exists', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).one()
    const save = await new GameSaveFactory([player]).one()
    await (<EntityManager>app.context.em).persistAndFlush(save)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${save.id}`)
      .send({ content: { progress: 10 }, name: 'New save name' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', save.player.id)
      .expect(200)

    expect(res.body.save.name).toBe('New save name')
  })

  it('should not update a game save if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [])
    const player = await new PlayerFactory([apiKey.game]).one()
    const save = await new GameSaveFactory([player]).one()
    await (<EntityManager>app.context.em).persistAndFlush(save)

    await request(app.callback())
      .patch(`${baseUrl}/${save.id}`)
      .send({ content: { progress: 10 } })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', save.player.id)
      .expect(403)
  })

  it('should not update another player\'s save from another game', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).one()
    const save = await new GameSaveFactory([player]).one()

    const [, game] = await createOrganisationAndGame(app.context.em)
    const otherPlayer = await new PlayerFactory([game]).one()
    const otherSave = await new GameSaveFactory([otherPlayer]).one()

    await (<EntityManager>app.context.em).persistAndFlush([save, otherSave])

    const res = await request(app.callback())
      .patch(`${baseUrl}/${otherSave.id}`)
      .send({ content: { progress: 10 } })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', save.player.id)
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Save not found' })
  })
})
