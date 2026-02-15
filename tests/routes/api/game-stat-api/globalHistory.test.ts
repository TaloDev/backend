import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import Game from '../../../../src/entities/game'
import PlayerGameStatSnapshot from '../../../../src/entities/player-game-stat-snapshot'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'
import { addMinutes, isSameDay } from 'date-fns'
import { randNumber } from '@ngneat/falso'
import PlayerGameStat from '../../../../src/entities/player-game-stat'
import GameStat from '../../../../src/entities/game-stat'

describe('Game stats API - global history', () => {
  const createStat = async (game: Game) => {
    const stat = await new GameStatFactory([game]).state(() => ({ maxValue: 999, maxChange: 99, global: true })).one()
    em.persist(stat)

    return stat
  }

  const createPlayerStat = async (stat: GameStat, extra: Partial<PlayerGameStat> = {}) => {
    const player = await new PlayerFactory([stat.game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => extra).one()
    em.persist(playerStat)

    return playerStat
  }

  it('should return global stat snapshots if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game)

    const changes = randNumber({ length: 10 })

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: await Promise.all(changes.map(async (change, idx) => {
        const playerStat = await createPlayerStat(stat, { value: change })
        await em.flush()

        const snapshot = new PlayerGameStatSnapshot()
        snapshot.construct(playerStat.player.aliases[0], playerStat)
        snapshot.change = change
        snapshot.createdAt = addMinutes(snapshot.createdAt, idx)

        return snapshot.toInsertable()
      })),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/v1/game-stats/${stat.internalName}/global-history`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
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

  it('should not return global stat snapshots if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const stat = await createStat(apiKey.game)
    await em.flush()

    await request(app)
      .get(`/v1/game-stats/${stat.internalName}/global-history`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not return global stat snapshots for a non-global stat', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game)
    stat.global = false
    await em.flush()

    const res = await request(app)
      .get(`/v1/game-stats/${stat.internalName}/global-history`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'This stat is not globally available' })
  })

  it('should not return global stat snapshots for a non-existent stat', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])

    const res = await request(app)
      .get('/v1/game-stats/blah/global-history')
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })

  it('should return global stat snapshots filtered by startDate', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game)

    const dates = [
      new Date('2025-03-19T09:00:00.000Z'),
      new Date('2025-03-20T09:00:00.000Z'),
      new Date('2025-03-21T09:00:00.000Z')
    ]

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: await Promise.all(dates.map(async (date) => {
        const snapshot = new PlayerGameStatSnapshot()
        const playerStat = await createPlayerStat(stat)
        await em.flush()

        snapshot.construct(playerStat.player.aliases[0], playerStat)
        snapshot.change = randNumber({ min: 1, max: 999 })
        snapshot.createdAt = date
        return snapshot.toInsertable()
      })),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/v1/game-stats/${stat.internalName}/global-history`)
      .query({ page: 0, startDate: dates[1] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.history).toHaveLength(2)
    expect(res.body.history.every((snapshot: PlayerGameStatSnapshot) => {
      return new Date(snapshot.createdAt) >= dates[1]
    })).toBe(true)
  })

  it('should return global stat snapshots filtered by endDate', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game)

    const dates = [
      new Date('2025-03-19T09:00:00.000Z'),
      new Date('2025-03-20T09:00:00.000Z'),
      new Date('2025-03-21T09:00:00.000Z')
    ]

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: await Promise.all(dates.map(async (date) => {
        const snapshot = new PlayerGameStatSnapshot()
        const playerStat = await createPlayerStat(stat)
        await em.flush()

        snapshot.construct(playerStat.player.aliases[0], playerStat)
        snapshot.change = randNumber({ min: 1, max: 999 })
        snapshot.createdAt = date
        return snapshot.toInsertable()
      })),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/v1/game-stats/${stat.internalName}/global-history`)
      .query({ page: 0, endDate: dates[1] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.history).toHaveLength(2)
    expect(res.body.history.every((snapshot: PlayerGameStatSnapshot) => {
      return new Date(snapshot.createdAt) <= dates[1]
    })).toBe(true)
  })

  it('should return global stat snapshots filtered by both startDate and endDate', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game)

    const dates = [
      new Date('2025-03-19T09:00:00.000Z'),
      new Date('2025-03-20T09:00:00.000Z'),
      new Date('2025-03-21T09:00:00.000Z')
    ]

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: await Promise.all(dates.map(async (date) => {
        const snapshot = new PlayerGameStatSnapshot()
        const playerStat = await createPlayerStat(stat)
        await em.flush()

        snapshot.construct(playerStat.player.aliases[0], playerStat)
        snapshot.change = randNumber({ min: 1, max: 999 })
        snapshot.createdAt = date
        return snapshot.toInsertable()
      })),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/v1/game-stats/${stat.internalName}/global-history`)
      .query({ page: 0, startDate: '2025-03-20', endDate: '2025-03-20' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.history).toHaveLength(1)
    expect(res.body.history.every((snapshot: PlayerGameStatSnapshot) => {
      return isSameDay(new Date(snapshot.createdAt), dates[1])
    })).toBe(true)
  })

  it('should return global stat snapshots filtered by player', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game)
    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await em.persist([player1, player2]).flush()

    const changesPlayer1 = randNumber({ length: 2 })
    const changesPlayer2 = randNumber({ length: 8 })

    const playerStat1 = await new PlayerGameStatFactory().construct(player1, stat).one()
    const playerStat2 = await new PlayerGameStatFactory().construct(player2, stat).one()
    await em.persist([playerStat1, playerStat2]).flush()

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: [...changesPlayer1, ...changesPlayer2].map((change, idx) => {
        const playerStat = idx < changesPlayer1.length ? playerStat1 : playerStat2

        const snapshot = new PlayerGameStatSnapshot()
        snapshot.construct(playerStat.player.aliases[0], playerStat)
        snapshot.change = change
        snapshot.createdAt = addMinutes(snapshot.createdAt, idx)

        return snapshot.toInsertable()
      }),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/v1/game-stats/${stat.internalName}/global-history`)
      .query({ page: 0, playerId: player1.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.history).toHaveLength(changesPlayer1.length)
    expect(res.body.count).toBe(changesPlayer1.length)
    expect(res.body.itemsPerPage).toBe(50)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should return a 404 when filtering by a non-existent player', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game)

    const changes = randNumber({ length: 10 })

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: await Promise.all(changes.map(async (change, idx) => {
        const playerStat = await createPlayerStat(stat, { value: change })
        await em.flush()

        const snapshot = new PlayerGameStatSnapshot()
        snapshot.construct(playerStat.player.aliases[0], playerStat)
        snapshot.change = change
        snapshot.createdAt = addMinutes(snapshot.createdAt, idx)

        return snapshot.toInsertable()
      })),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/v1/game-stats/${stat.internalName}/global-history`)
      .query({ page: 0, playerId: 'ae5dbdef-c609-4547-a45b-b79af70324b0' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should return paginated global stat snapshots', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game)

    const changes = randNumber({ min: 1, max: 999, length: 60 })

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: await Promise.all(changes.map(async (change, idx) => {
        const playerStat = await createPlayerStat(stat, { value: change })
        await em.flush()

        const snapshot = new PlayerGameStatSnapshot()
        snapshot.construct(playerStat.player.aliases[0], playerStat)
        snapshot.change = change
        snapshot.createdAt = addMinutes(snapshot.createdAt, idx)

        return snapshot.toInsertable()
      })),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/v1/game-stats/${stat.internalName}/global-history`)
      .query({ page: 1 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.history).toHaveLength(10)
    expect(res.body.count).toBe(60)
    expect(res.body.itemsPerPage).toBe(50)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should return globalValue with correct shape and values', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game)
    stat.globalValue = stat.defaultValue

    const changes = randNumber({ min: 1, max: 999, length: 10 })
    const globalValues: number[] = []

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: await Promise.all(changes.map(async (change, idx) => {
        const playerStat = await createPlayerStat(stat, { value: change })
        stat.globalValue += change
        globalValues.push(stat.globalValue)

        const snapshot = new PlayerGameStatSnapshot()
        snapshot.construct(playerStat.player.aliases[0], playerStat)
        snapshot.change = change
        snapshot.createdAt = addMinutes(snapshot.createdAt, idx)

        await em.flush()

        return snapshot.toInsertable()
      })),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/v1/game-stats/${stat.internalName}/global-history`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.globalValue).toHaveProperty('minValue')
    expect(res.body.globalValue).toHaveProperty('maxValue')
    expect(res.body.globalValue).toHaveProperty('medianValue')
    expect(res.body.globalValue).toHaveProperty('averageValue')
    expect(res.body.globalValue).toHaveProperty('averageChange')

    expect(res.body.globalValue.averageValue).toBe(
      globalValues.reduce((acc, val) => acc + val, 0) / changes.length
    )

    expect(res.body.globalValue.averageChange).toBe(
      changes.reduce((acc, val) => acc + val, 0) / changes.length
    )

    expect(res.body.playerValue).toHaveProperty('averageValue')

    expect(res.body.playerValue.averageValue).toBe(
      changes.reduce((acc, val) => acc + val, 0) / changes.length
    )
  })

  it('should return globalValue metrics equal to the stat default when there are no snapshots', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const stat = await createStat(apiKey.game)
    await em.flush()

    const res = await request(app)
      .get(`/v1/game-stats/${stat.internalName}/global-history`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.globalValue).toHaveProperty('minValue', stat.defaultValue)
    expect(res.body.globalValue).toHaveProperty('maxValue', stat.defaultValue)
    expect(res.body.globalValue).toHaveProperty('medianValue', stat.defaultValue)
    expect(res.body.globalValue).toHaveProperty('averageValue', stat.defaultValue)
    expect(res.body.globalValue).toHaveProperty('averageChange', 0)

    expect(res.body.playerValue).toHaveProperty('minValue', stat.defaultValue)
    expect(res.body.playerValue).toHaveProperty('maxValue', stat.defaultValue)
    expect(res.body.playerValue).toHaveProperty('medianValue', stat.defaultValue)
    expect(res.body.playerValue).toHaveProperty('averageValue', stat.defaultValue)
  })
})
