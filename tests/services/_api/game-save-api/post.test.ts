import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import { randText } from '@ngneat/falso'

describe('Game save API service - post', () => {
  it('should create a game save if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .post('/v1/game-saves')
      .send({ name: 'save', content: {} })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)
  })

  it('should not create a game save if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .post('/v1/game-saves')
      .send({ name: 'save', content: {} })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(403)
  })

  it('should not create a game save for a missing player', async () => {
    const [, token] = await createAPIKeyAndToken([])

    const res = await request(app)
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

    await em.persistAndFlush(otherPlayer)

    const res = await request(app)
      .post('/v1/game-saves')
      .send({ name: 'save', content: {} })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', otherPlayer.id)
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should convert content to JSON if it is a string', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/game-saves')
      .send({ name: 'save', content: '{"progress": 10}' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)

    expect(res.body.save.content).toStrictEqual({ progress: 10 })
  })

  it('should handle save names being too long', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/game-saves')
      .send({ name: randText({ charCount: 512 }), content: {} })
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
