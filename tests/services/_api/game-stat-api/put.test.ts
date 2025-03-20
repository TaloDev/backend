import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import GameStat from '../../../../src/entities/game-stat'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import Game from '../../../../src/entities/game'
import { subHours } from 'date-fns'
import { ClickHousePlayerGameStatSnapshot } from '../../../../src/entities/player-game-stat-snapshot'

describe('Game stats API service - put', () => {
  const createStat = async (game: Game, props: Partial<GameStat>) => {
    const em: EntityManager  = global.em

    const stat = await new GameStatFactory([game]).state(() => ({ ...props })).one()
    em.persist(stat)

    return stat
  }

  it('should create a player stat if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)
  })

  it('should not create a player stat if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(403)
  })

  it('should not create a player stat for a missing player', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    const res = await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', '12345')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not create a player stat if the last update was less than the min time between updates', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99, minTimeBetweenUpdates: 30 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)

    const res = await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Stat cannot be updated more often than every 30 seconds' })
  })

  it('should not create a player stat if the change is greater than the max change', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    const res = await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 100 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Stat change cannot be more than 99' })
  })

  it('should create a player stat if there is no max change', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, defaultValue: 1, maxChange: null })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 998 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)
  })

  it('should not create a player stat if the change would bring the value below the min value', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99, minValue: -1, defaultValue: 0 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    const res = await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: -2 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Stat would go below the minValue of -1' })
  })

  it('should create a player stat if there is no min value', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99, minValue: null, defaultValue: 0 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: -99 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)
  })

  it('should not create a player stat if the change would bring the value above the max value', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxChange: 99, maxValue: 3, defaultValue: 0 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    const res = await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 4 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Stat would go above the maxValue of 3' })
  })

  it('should create a player stat if there is no max value', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: null, maxChange: 99, defaultValue: 0 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 99 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)
  })

  it('should update an existing player stat', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99, defaultValue: 0, global: false })
    const player = await new PlayerFactory([apiKey.game]).one()
    const playerStat = await new PlayerGameStatFactory()
      .construct(player, stat)
      .state(() => ({ value: 10, createdAt: new Date(2021, 1, 1) }))
      .one()
    await global.em.persistAndFlush(playerStat)

    const res = await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 50 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)

    expect(res.body.playerStat.value).toBe(60)
  })

  it('should increment global stats', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99, defaultValue: 0, global: true, globalValue: 0 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    const res = await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 50 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)

    expect(res.body.playerStat.value).toBe(50)

    await global.em.refresh(stat)
    expect(stat.globalValue).toBe(50)
  })

  it('should not update a non-existent stat', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    const res = await request(global.app)
      .put('/v1/game-stats/blah')
      .send({ change: 50 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })

  it('should set the createdAt of the player stat to the continuity date', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS, APIKeyScope.WRITE_CONTINUITY_REQUESTS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    const continuityDate = subHours(new Date(), 1)

    const res = await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-continuity-timestamp', String(continuityDate.getTime()))
      .expect(200)

    expect(res.body.playerStat.createdAt).toBe(continuityDate.toISOString())
  })

  it('should create a player game stat snapshot', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99, defaultValue: 0, global: true, globalValue: 0 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 50 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)

    let snapshots: ClickHousePlayerGameStatSnapshot[] = []
    await vi.waitUntil(async () => {
      snapshots = await global.clickhouse.query({
        query: `SELECT * FROM player_game_stat_snapshots WHERE game_stat_id = ${stat.id} AND player_id = '${player.id}'`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerGameStatSnapshot>())
      return snapshots.length === 1
    })

    expect(snapshots[0].change).toBe(50)
    expect(snapshots[0].value).toBe(50)
    expect(snapshots[0].global_value).toBe(50)
  })
})
