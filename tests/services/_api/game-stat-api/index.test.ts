
import request from 'supertest'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import { APIKeyScope } from '../../../../src/entities/api-key'

describe('Game stats API service - index', () => {
  it('should get game stats if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const gameStats = await new GameStatFactory([apiKey.game]).many(3)
    await em.persistAndFlush([...gameStats])

    const res = await request(app)
      .get('/v1/game-stats')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stats).toHaveLength(gameStats.length)
  })

  it('should not return game stats if the scope is not valid', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(app)
      .get('/v1/game-stats')
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
