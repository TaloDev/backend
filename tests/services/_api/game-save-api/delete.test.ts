import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import GameSaveFactory from '../../../fixtures/GameSaveFactory.js'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'

describe('Game save API service - delete', () => {
  it('should delete a game save if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).one()
    const save = await new GameSaveFactory([player]).one()
    await (<EntityManager>global.em).persistAndFlush(save)

    await request(global.app)
      .delete(`/v1/game-saves/${save.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', save.player.id)
      .expect(204)
  })

  it('should not delete a game save if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player = await new PlayerFactory([apiKey.game]).one()
    const save = await new GameSaveFactory([player]).one()
    await (<EntityManager>global.em).persistAndFlush(save)

    await request(global.app)
      .delete(`/v1/game-saves/${save.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', save.player.id)
      .expect(403)
  })

  it('should not delete another player\'s save', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).one()

    const [, game] = await createOrganisationAndGame()
    const otherPlayer = await new PlayerFactory([game]).one()
    const otherSave = await new GameSaveFactory([otherPlayer]).one()

    await (<EntityManager>global.em).persistAndFlush([player, otherSave])

    const res = await request(global.app)
      .delete(`/v1/game-saves/${otherSave.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Save not found' })
  })

  it('should not delete a player\'s save from another game', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).one()
    const save = await new GameSaveFactory([player]).one()

    const [, game] = await createOrganisationAndGame()
    const otherPlayer = await new PlayerFactory([game]).one()
    const otherSave = await new GameSaveFactory([otherPlayer]).one()

    await (<EntityManager>global.em).persistAndFlush([save, otherSave])

    const res = await request(global.app)
      .delete(`/v1/game-saves/${otherSave.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', otherPlayer.id)
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Save not found' })
  })
})
