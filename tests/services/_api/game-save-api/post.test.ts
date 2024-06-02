import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'

describe('Game save API service - post', () => {
  it('should create a game save if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    await request(global.app)
      .post('/v1/game-saves')
      .send({ name: 'save', content: {} })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)
  })

  it('should not create a game save if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player = await new PlayerFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    await request(global.app)
      .post('/v1/game-saves')
      .send({ name: 'save', content: {} })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(403)
  })

  it('should not create a game save for a missing player', async () => {
    const [, token] = await createAPIKeyAndToken([])

    const res = await request(global.app)
      .post('/v1/game-saves')
      .send({ name: 'save', content: {} })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', '123456')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not create a game save for a player from another game', async () => {
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
