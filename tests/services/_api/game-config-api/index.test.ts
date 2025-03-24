import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Game config API service - index', () => {
  it('should return the game config if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CONFIG])
    await em.populate(apiKey, ['game'])

    const res = await request(app)
      .get('/v1/game-config')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.config).toHaveLength(apiKey.game.props.length)
  })

  it('should not return the game config if the scope is not valid', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(app)
      .get('/v1/game-config')
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should filter out meta props from the game config', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CONFIG])
    await em.populate(apiKey, ['game'])
    apiKey.game.props.push({ key: 'META_PREV_NAME', value: 'LD51' })
    await em.flush()

    const res = await request(app)
      .get('/v1/game-config')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.config).toHaveLength(apiKey.game.props.length - 1)
  })
})
