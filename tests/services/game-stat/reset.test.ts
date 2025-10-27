import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import GameStatFactory from '../../fixtures/GameStatFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import PlayerGameStatFactory from '../../fixtures/PlayerGameStatFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import PlayerGameStat from '../../../src/entities/player-game-stat'
import GameStat from '../../../src/entities/game-stat'
import Player from '../../../src/entities/player'
import userPermissionProvider from '../../utils/userPermissionProvider'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import assert from 'node:assert'
import PlayerGameStatSnapshot from '../../../src/entities/player-game-stat-snapshot'
import { FlushStatSnapshotsQueueHandler } from '../../../src/lib/queues/game-metrics/flush-stat-snapshots-queue-handler'

describe('GameStat service - reset', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ], 200))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({ global: true, globalValue: 500, defaultValue: 100 })).one()

    const devPlayers = await new PlayerFactory([game]).devBuild().many(3)
    const livePlayers = await new PlayerFactory([game]).many(3)
    const allPlayers = [...devPlayers, ...livePlayers]

    const playerStats = await Promise.all(allPlayers.map(async (player) => {
      return new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 50 })).one()
    }))
    await em.persistAndFlush(playerStats)

    const res = await request(app)
      .delete(`/games/${game.id}/game-stats/${stat.id}/player-stats`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_RESET,
      game
    })

    if (statusCode === 200) {
      expect(res.body.deletedCount).toBe(6)

      const playerStats = await em.repo(PlayerGameStat).find({ stat })
      expect(playerStats).toHaveLength(0)

      await em.refresh(stat)
      expect(stat.globalValue).toBe(stat.defaultValue)

      assert(activity?.extra.display)
      expect(activity.extra.statInternalName).toBe(stat.internalName)
      expect(activity.extra.display['Reset mode']).toBe('All players')
      expect(activity.extra.display['Deleted count']).toBe(6)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to reset stats' })
      expect(activity).toBeNull()
    }
  })

  it('should reset all player stats when mode is "all"', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({ global: true, globalValue: 300, defaultValue: 0 })).one()

    const devPlayers = await new PlayerFactory([game]).devBuild().many(2)
    const livePlayers = await new PlayerFactory([game]).many(3)
    const allPlayers = [...devPlayers, ...livePlayers]

    const playerStats = await Promise.all(allPlayers.map(async (player) => {
      return new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 25 })).one()
    }))
    await em.persistAndFlush(playerStats)

    const res = await request(app)
      .delete(`/games/${game.id}/game-stats/${stat.id}/player-stats`)
      .query({ mode: 'all' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(5)

    const remainingPlayerStats = await em.repo(PlayerGameStat).find({ stat })
    expect(remainingPlayerStats).toHaveLength(0)

    await em.refresh(stat)
    expect(stat.globalValue).toBe(stat.defaultValue)
  })

  it('should reset only dev player stats when mode is "dev"', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({ global: true, globalValue: 400, defaultValue: 0 })).one()

    const devPlayers = await new PlayerFactory([game]).devBuild().many(2)
    const livePlayers = await new PlayerFactory([game]).many(3)

    const devPlayerStats = await Promise.all(devPlayers.map(async (player) => {
      return new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 30 })).one()
    }))
    const livePlayerStats = await Promise.all(livePlayers.map(async (player) => {
      return new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 40 })).one()
    }))

    await em.persistAndFlush([...devPlayerStats, ...livePlayerStats])

    const res = await request(app)
      .delete(`/games/${game.id}/game-stats/${stat.id}/player-stats`)
      .query({ mode: 'dev' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(2)

    const remainingPlayerStats = await em.repo(PlayerGameStat).find({
      stat
    }, {
      populate: ['player']
    })
    expect(remainingPlayerStats).toHaveLength(3)
    expect(remainingPlayerStats.every((playerStat) => !playerStat.player.devBuild)).toBe(true)

    await em.refresh(stat)
    expect(stat.globalValue).toBe(stat.defaultValue)
  })

  it('should reset only live player stats when mode is "live"', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({ global: true, globalValue: 500, defaultValue: 0 })).one()

    const devPlayers = await new PlayerFactory([game]).devBuild().many(2)
    const livePlayers = await new PlayerFactory([game]).many(3)

    const devPlayerStats = await Promise.all(devPlayers.map(async (player) => {
      return new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 35 })).one()
    }))
    const livePlayerStats = await Promise.all(livePlayers.map(async (player) => {
      return new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 45 })).one()
    }))

    await em.persistAndFlush([...devPlayerStats, ...livePlayerStats])

    const res = await request(app)
      .delete(`/games/${game.id}/game-stats/${stat.id}/player-stats`)
      .query({ mode: 'live' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(3)

    const remainingPlayerStats = await em.repo(PlayerGameStat).find({
      stat
    }, {
      populate: ['player']
    })
    expect(remainingPlayerStats).toHaveLength(2)
    expect(remainingPlayerStats.every((playerStat) => playerStat.player.devBuild)).toBe(true)

    await em.refresh(stat)
    expect(stat.globalValue).toBe(stat.defaultValue)
  })

  it('should return 0 deleted count when no player stats match the mode', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({ global: true, globalValue: 200, defaultValue: 0 })).one()

    const devPlayers = await new PlayerFactory([game]).devBuild().many(2)
    const devPlayerStats = await Promise.all(devPlayers.map(async (player) => {
      return new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 20 })).one()
    }))

    await em.persistAndFlush(devPlayerStats)

    const res = await request(app)
      .delete(`/games/${game.id}/game-stats/${stat.id}/player-stats`)
      .query({ mode: 'live' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(0)

    const remainingPlayerStats = await em.repo(PlayerGameStat).find({ stat })
    expect(remainingPlayerStats).toHaveLength(2)

    await em.refresh(stat)
    expect(stat.globalValue).toBe(stat.defaultValue)
  })

  it('should create game activity with correct data', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({ global: false })).one()
    const players = await new PlayerFactory([game]).many(3)
    const playerStats = await Promise.all(players.map(async (player) => {
      return new PlayerGameStatFactory().construct(player, stat).one()
    }))

    await em.persistAndFlush(playerStats)

    await request(app)
      .delete(`/games/${game.id}/game-stats/${stat.id}/player-stats`)
      .query({ mode: 'dev' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_RESET,
      game,
      user
    })

    expect(activity).not.toBeNull()
    expect(activity!.extra).toEqual({
      statInternalName: stat.internalName,
      display: {
        'Reset mode': 'Dev players',
        'Deleted count': expect.any(Number)
      }
    })
  })

  it('should not reset player stats for a stat in a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const stat = await new GameStatFactory([otherGame]).one()
    const players = await new PlayerFactory([otherGame]).many(2)
    const playerStats = await Promise.all(players.map(async (player) => {
      return new PlayerGameStatFactory().construct(player, stat).one()
    }))

    await em.persistAndFlush(playerStats)

    const res = await request(app)
      .delete(`/games/${otherGame.id}/game-stats/${stat.id}/player-stats`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })

    const remainingPlayerStats = await em.repo(PlayerGameStat).find({ stat })
    expect(remainingPlayerStats).toHaveLength(2)
  })

  it('should not reset player stats for a non-existent stat', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .delete(`/games/${game.id}/game-stats/99999/player-stats`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })

  it('should handle invalid reset mode gracefully', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).one()
    await em.persistAndFlush(stat)

    const res = await request(app)
      .delete(`/games/${game.id}/game-stats/${stat.id}/player-stats`)
      .query({ mode: 'invalid' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        mode: ['Mode must be one of: all, live, dev']
      }
    })
  })

  it('should reset player stats and maintain referential integrity', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).one()
    const players = await new PlayerFactory([game]).many(2)
    const playerStats = await Promise.all(players.map(async (player) => {
      return new PlayerGameStatFactory().construct(player, stat).one()
    }))

    await em.persistAndFlush(playerStats)

    await request(app)
      .delete(`/games/${game.id}/game-stats/${stat.id}/player-stats`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    const existingStat = await em.repo(GameStat).findOne(stat.id)
    expect(existingStat).not.toBeNull()

    const existingPlayers = await em.repo(Player).find({})
    expect(existingPlayers.length).toBeGreaterThanOrEqual(2)
  })

  it('should reset global stat value to default value for global stats', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({
      global: true,
      globalValue: 1000,
      defaultValue: 250
    })).one()

    const players = await new PlayerFactory([game]).many(3)
    const playerStats = await Promise.all(players.map(async (player) => {
      return new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 100 })).one()
    }))

    await em.persistAndFlush(playerStats)

    await request(app)
      .delete(`/games/${game.id}/game-stats/${stat.id}/player-stats`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    await em.refresh(stat)
    expect(stat.globalValue).toBe(250)
  })

  it('should handle resetting stats with no player stats gracefully', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({
      global: true,
      globalValue: 300,
      defaultValue: 0
    })).one()

    await em.persistAndFlush(stat)

    const res = await request(app)
      .delete(`/games/${game.id}/game-stats/${stat.id}/player-stats`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(0)

    await em.refresh(stat)
    expect(stat.globalValue).toBe(stat.defaultValue)

    const activity = await em.repo(GameActivity).findOneOrFail({
      type: GameActivityType.GAME_STAT_RESET,
      game
    })
    expect(activity.extra.display?.['Deleted count']).toBe(0)
  })

  it('should batch clickhouse deletions when resetting stats with over 100 player aliases', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({
      global: true,
      globalValue: 1000,
      defaultValue: 0
    })).one()

    const players = await new PlayerFactory([game]).many(105)
    const playerStats = await Promise.all(players.map(async (player) => {
      return new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()
    }))

    await em.persistAndFlush(playerStats)

    const handler = new FlushStatSnapshotsQueueHandler()
    for (const playerStat of playerStats) {
      const alias = playerStat.player.aliases[0]
      await handler.add(new PlayerGameStatSnapshot().construct(alias, playerStat))
    }
    await handler.handle()

    let snapshotCount = 0
    await vi.waitUntil(async () => {
      const result = await clickhouse.query({
        query: `SELECT COUNT(*) as count FROM player_game_stat_snapshots WHERE game_stat_id = ${stat.id}`,
        format: 'JSONEachRow'
      })
      const rows = await result.json<{ count: string }>()
      snapshotCount = parseInt(rows[0].count)
      return snapshotCount === 105
    }, { timeout: 10000 })

    expect(snapshotCount).toBe(105)

    const res = await request(app)
      .delete(`/games/${game.id}/game-stats/${stat.id}/player-stats`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(105)

    const remainingPlayerStats = await em.repo(PlayerGameStat).find({ stat })
    expect(remainingPlayerStats).toHaveLength(0)

    await vi.waitUntil(async () => {
      const result = await clickhouse.query({
        query: `SELECT COUNT(*) as count FROM player_game_stat_snapshots WHERE game_stat_id = ${stat.id}`,
        format: 'JSONEachRow'
      })
      const rows = await result.json<{ count: string }>()
      const count = parseInt(rows[0].count)
      return count === 0
    })

    const finalResult = await clickhouse.query({
      query: `SELECT COUNT(*) as count FROM player_game_stat_snapshots WHERE game_stat_id = ${stat.id}`,
      format: 'JSONEachRow'
    })
    const finalRows = await finalResult.json<{ count: string }>()
    const finalCount = parseInt(finalRows[0].count)
    expect(finalCount).toBe(0)

    await em.refresh(stat)
    expect(stat.globalValue).toBe(stat.defaultValue)
  })
})
