import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Game stats API - get', () => {
  it('should get a game stat if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const gameStat = await new GameStatFactory([apiKey.game]).one()
    await em.persistAndFlush(gameStat)

    await request(app)
      .get(`/v1/game-stats/${gameStat.internalName}`)
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should not get a game stat if the scope is invalid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const gameStat = await new GameStatFactory([apiKey.game]).one()
    await em.persistAndFlush(gameStat)

    await request(app)
      .get(`/v1/game-stats/${gameStat.internalName}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should return a 404 for a non-existent game stat', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])

    await request(app).get('/v1/game-stats/blah').auth(token, { type: 'bearer' }).expect(404)
  })
})
