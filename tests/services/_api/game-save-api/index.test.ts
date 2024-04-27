import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameSaveFactory from '../../../fixtures/GameSaveFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'

describe('Game save API service - index', () => {
  it('should return game saves if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_SAVES])
    const players = await new PlayerFactory([apiKey.game]).many(4)
    const saves = await new GameSaveFactory(players).many(5)
    await (<EntityManager>global.em).persistAndFlush(saves)

    const res = await request(global.app)
      .get('/v1/game-saves')
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', saves[0].player.id)
      .expect(200)

    const length = saves.filter((save) => save.player.id === saves[0].player.id).length
    expect(res.body.saves).toHaveLength(length)
  })

  it('should not return game saves if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const players = await new PlayerFactory([apiKey.game]).many(4)
    const saves = await new GameSaveFactory(players).many(5)
    await (<EntityManager>global.em).persistAndFlush(saves)

    await request(global.app)
      .get('/v1/game-saves')
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', saves[0].player.id)
      .expect(403)
  })

  it('should not return game saves for a missing player', async () => {
    const [, token] = await createAPIKeyAndToken([])

    const res = await request(global.app)
      .get('/v1/game-saves')
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', '123456')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not return game saves for a player from another game', async () => {
    const [, token] = await createAPIKeyAndToken([])
    const [, game] = await createOrganisationAndGame()
    const otherPlayer = await new PlayerFactory([game]).one()

    await (<EntityManager>global.em).persistAndFlush(otherPlayer)

    const res = await request(global.app)
      .post('/v1/game-saves')
      .send({ name: 'save', content: {} })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', otherPlayer.id)
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
