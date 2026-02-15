import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import Game from '../../../../src/entities/game'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'
import GameStat from '../../../../src/entities/game-stat'
import PlayerGameStat from '../../../../src/entities/player-game-stat'

describe('Game stats API - get player stat', () => {
  const createStat = async (game: Game) => {
    const stat = await new GameStatFactory([game]).state(() => ({ maxValue: 999, maxChange: 99 })).one()
    em.persist(stat)

    return stat
  }

  const createPlayerStat = async (stat: GameStat, extra: Partial<PlayerGameStat> = {}) => {
    const player = await new PlayerFactory([stat.game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => extra).one()
    em.persist(playerStat)

    return playerStat
  }

  it('should return a player stat if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game)
    const playerStat = await createPlayerStat(stat, { value: 42 })
    await em.flush()

    const res = await request(app)
      .get(`/v1/game-stats/${stat.internalName}/player-stat`)
      .set('x-talo-alias', String(playerStat.player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.playerStat).toBeDefined()
    expect(res.body.playerStat.value).toBe(42)
    expect(res.body.playerStat.stat.id).toBe(stat.id)
  })

  it('should return a null playerStat if the player has no stats', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game)
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .get(`/v1/game-stats/${stat.internalName}/player-stat`)
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.playerStat).toBeNull()
  })

  it('should not return a player stat if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const stat = await createStat(apiKey.game)
    const playerStat = await createPlayerStat(stat)
    await em.flush()

    await request(app)
      .get(`/v1/game-stats/${stat.internalName}/player-stat`)
      .set('x-talo-alias', String(playerStat.player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should return a 404 for a non-existent stat', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .get('/v1/game-stats/non-existent/player-stat')
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })

  it('should return a 404 for a non-existent alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game)
    await em.flush()

    const res = await request(app)
      .get(`/v1/game-stats/${stat.internalName}/player-stat`)
      .set('x-talo-alias', '21312321')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
