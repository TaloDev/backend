import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Game stat API - list player stats', () => {
  it('should return player stats if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat1 = await new GameStatFactory([apiKey.game]).one()
    const stat2 = await new GameStatFactory([apiKey.game]).one()
    const player = await new PlayerFactory([apiKey.game]).one()

    const playerStat1 = await new PlayerGameStatFactory()
      .construct(player, stat1)
      .state(() => ({ value: 42 }))
      .one()
    const playerStat2 = await new PlayerGameStatFactory()
      .construct(player, stat2)
      .state(() => ({ value: 66 }))
      .one()
    await em.persistAndFlush([playerStat1, playerStat2])

    const res = await request(app)
      .get('/v1/game-stats/player-stats')
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.playerStats).toHaveLength(2)
    expect(res.body.playerStats[0].value).toBe(playerStat1.value)
    expect(res.body.playerStats[0].stat.id).toBe(playerStat1.stat.id)
    expect(res.body.playerStats[1].value).toBe(playerStat2.value)
    expect(res.body.playerStats[1].stat.id).toBe(playerStat2.stat.id)
  })

  it('should return an empty array if the player has no stats', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .get('/v1/game-stats/player-stats')
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.playerStats).toEqual([])
  })

  it('should not return player stats if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .get('/v1/game-stats/player-stats')
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should return a 404 for a non-existent alias', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    await em.flush()

    const res = await request(app)
      .get('/v1/game-stats/player-stats')
      .set('x-talo-alias', '21312321')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
