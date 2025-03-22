
import request from 'supertest'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import { APIKeyScope } from '../../../../src/entities/api-key'

describe('GameStat API service - index', () => {
  it('should get game stats if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const gameStats = await new GameStatFactory([apiKey.game]).many(3)
    await global.em.persistAndFlush([...gameStats])

    const res = await request(global.app)
      .get('/v1/game-stats')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stats).toHaveLength(gameStats.length)
  })
})
