import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameSaveFactory from '../../../fixtures/GameSaveFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import { randText } from '@ngneat/falso'

describe('Game save API - patch', () => {
  it('should update a game save if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).one()
    const save = await new GameSaveFactory([player]).one()
    await em.persistAndFlush(save)

    const res = await request(app)
      .patch(`/v1/game-saves/${save.id}`)
      .send({ content: { progress: 10 } })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', save.player.id)
      .expect(200)

    expect(res.body.save.content).toStrictEqual({
      progress: 10
    })
  })

  it('should update the game save name if the key exists', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).one()
    const save = await new GameSaveFactory([player]).one()
    await em.persistAndFlush(save)

    const res = await request(app)
      .patch(`/v1/game-saves/${save.id}`)
      .send({ content: { progress: 10 }, name: 'New save name' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', save.player.id)
      .expect(200)

    expect(res.body.save.name).toBe('New save name')
  })

  it('should not update a game save if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player = await new PlayerFactory([apiKey.game]).one()
    const save = await new GameSaveFactory([player]).one()
    await em.persistAndFlush(save)

    await request(app)
      .patch(`/v1/game-saves/${save.id}`)
      .send({ content: { progress: 10 } })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', save.player.id)
      .expect(403)
  })

  it('should not update another player\'s save from another game', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).one()
    const save = await new GameSaveFactory([player]).one()

    const [, game] = await createOrganisationAndGame()
    const otherPlayer = await new PlayerFactory([game]).one()
    const otherSave = await new GameSaveFactory([otherPlayer]).one()

    await em.persistAndFlush([save, otherSave])

    const res = await request(app)
      .patch(`/v1/game-saves/${otherSave.id}`)
      .send({ content: { progress: 10 } })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', save.player.id)
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Save not found' })
  })

  it('should handle save names being too long', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).one()
    const save = await new GameSaveFactory([player]).one()
    await em.persistAndFlush(save)

    const res = await request(app)
      .patch(`/v1/game-saves/${save.id}`)
      .send({ content: {}, name: randText({ charCount: 512 }) })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        name: ['name is too long']
      }
    })
  })
})
