import request from 'supertest'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import { APIKeyScope } from '../../../../src/entities/api-key'

describe('GameStat API service - get', () => {
  it('should get game stats if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const gameStats = await new GameStatFactory([apiKey.game]).many(3)
    await global.em.persistAndFlush([...gameStats])

    const res = await request(global.app)
      .get('/v1/game-stats')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.gameStats).toHaveLength(gameStats.length)
  })

  it('should get a game stat entry for a specific alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const gameStat = await new GameStatFactory([apiKey.game]).one()
    await global.em.persistAndFlush(gameStat)

    await request(global.app)
      .get(`/v1/game-stats/${gameStat.internalName}`)
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should not get entries for a non-existent game stat', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])

    await request(global.app)
      .get('/v1/game-stats/blah')
      .auth(token, { type: 'bearer' })
      .expect(404)
  })
})
