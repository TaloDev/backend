import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import GameStat from '../../../../src/entities/game-stat'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import Game from '../../../../src/entities/game'
import PlayerGameStatSnapshot from '../../../../src/entities/player-game-stat-snapshot'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'
import { addMinutes, isSameDay } from 'date-fns'
import { randNumber } from '@ngneat/falso'

describe('Game stats API service - history', () => {
  const createStat = async (game: Game, props: Partial<GameStat>) => {
    const em: EntityManager  = global.em

    const stat = await new GameStatFactory([game]).state(() => ({ ...props })).one()
    em.persist(stat)

    return stat
  }

  it('should return player stat snapshots if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    const changes = [5, 10, 15]

    await global.clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: await Promise.all(changes.map(async (change, idx, arr) => {
        const currentValue = arr
          .slice(0, idx)
          .reduce((sum, val) => sum + val, stat.defaultValue)

        const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: currentValue })).one()
        await global.em.persistAndFlush(playerStat)

        stat.globalValue += change
        const snapshot = new PlayerGameStatSnapshot()
        snapshot.construct(playerStat)
        snapshot.change = change
        snapshot.createdAt = addMinutes(snapshot.createdAt, idx)

        return snapshot.toInsertable()
      })),
      format: 'JSONEachRow'
    })

    const res = await request(global.app)
      .get(`/v1/game-stats/${stat.internalName}/history`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)

    expect(res.body.history).toHaveLength(changes.length)
    expect(res.body.count).toBe(changes.length)
    expect(res.body.itemsPerPage).toBe(50)
    expect(res.body.isLastPage).toBe(true)

    const reversedChanges = changes.reverse()
    for (let i = 0; i < changes.length; i++) {
      expect(res.body.history[i].change).toBe(reversedChanges[i])
    }
  })

  it('should not return player stat snapshots if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    await request(global.app)
      .get(`/v1/game-stats/${stat.internalName}/history`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(403)
  })

  it('should not return player stat snapshots for a missing player', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    const res = await request(global.app)
      .get(`/v1/game-stats/${stat.internalName}/history`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', '12345')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not return player stat snapshots for a non-existent stat', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await global.em.persistAndFlush(player)

    const res = await request(global.app)
      .get('/v1/game-stats/blah/history')
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })

  it('should return player stat snapshots filtered by startDate', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).one()
    await global.em.persistAndFlush(playerStat)

    const dates = [
      new Date('2025-03-19T09:00:00.000Z'),
      new Date('2025-03-20T09:00:00.000Z'),
      new Date('2025-03-21T09:00:00.000Z')
    ]

    await global.clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: dates.map((date) => {
        const snapshot = new PlayerGameStatSnapshot()
        snapshot.construct(playerStat)
        snapshot.change = randNumber({ min: 1, max: 999 })
        snapshot.createdAt = date
        return snapshot.toInsertable()
      }),
      format: 'JSONEachRow'
    })

    const res = await request(global.app)
      .get(`/v1/game-stats/${stat.internalName}/history`)
      .query({ page: 0, startDate: dates[1] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)

    expect(res.body.history).toHaveLength(2)
    expect(res.body.history.every((snapshot: PlayerGameStatSnapshot) => {
      return new Date(snapshot.createdAt) >= dates[1]
    })).toBe(true)
  })

  it('should return player stat snapshots filtered by endDate', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).one()
    await global.em.persistAndFlush(playerStat)

    const dates = [
      new Date('2025-03-19T09:00:00.000Z'),
      new Date('2025-03-20T09:00:00.000Z'),
      new Date('2025-03-21T09:00:00.000Z')
    ]

    await global.clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: dates.map((date) => {
        const snapshot = new PlayerGameStatSnapshot()
        snapshot.construct(playerStat)
        snapshot.change = randNumber({ min: 1, max: 999 })
        snapshot.createdAt = date
        return snapshot.toInsertable()
      }),
      format: 'JSONEachRow'
    })

    const res = await request(global.app)
      .get(`/v1/game-stats/${stat.internalName}/history`)
      .query({ page: 0, endDate: dates[1] })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)

    expect(res.body.history).toHaveLength(2)
    expect(res.body.history.every((snapshot: PlayerGameStatSnapshot) => {
      return new Date(snapshot.createdAt) <= dates[1]
    })).toBe(true)
  })

  it('should return player stat snapshots filtered by both startDate and endDate', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).one()
    await global.em.persistAndFlush(playerStat)

    const dates = [
      new Date('2025-03-19T09:00:00.000Z'),
      new Date('2025-03-20T09:00:00.000Z'),
      new Date('2025-03-21T09:00:00.000Z')
    ]

    await global.clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: dates.map((date) => {
        const snapshot = new PlayerGameStatSnapshot()
        snapshot.construct(playerStat)
        snapshot.change = randNumber({ min: 1, max: 999 })
        snapshot.createdAt = date
        return snapshot.toInsertable()
      }),
      format: 'JSONEachRow'
    })

    const res = await request(global.app)
      .get(`/v1/game-stats/${stat.internalName}/history`)
      .query({ page: 0, startDate: '2025-03-20', endDate: '2025-03-20' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(200)

    expect(res.body.history).toHaveLength(1)
    expect(res.body.history.every((snapshot: PlayerGameStatSnapshot) => {
      return isSameDay(new Date(snapshot.createdAt), dates[1])
    })).toBe(true)
  })
})
