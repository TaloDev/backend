import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import GameStat from '../../../../src/entities/game-stat'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import Game from '../../../../src/entities/game'
import PlayerGameStatSnapshot, { ClickHousePlayerGameStatSnapshot } from '../../../../src/entities/player-game-stat-snapshot'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'
import { FlushStatSnapshotsQueueHandler } from '../../../../src/lib/queues/game-metrics/flush-stat-snapshots-queue-handler'

describe('Game stats API service - snapshot flushing', () => {
  const createStat = async (game: Game) => {
    const stat = await new GameStatFactory([game]).state(() => ({ maxValue: 999, maxChange: 99 })).one()
    em.persist(stat)

    return stat
  }

  const createPlayerStat = async (stat: GameStat) => {
    const player = await new PlayerFactory([stat.game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).one()
    em.persist(playerStat)

    return playerStat
  }

  it('should flush player game stat snapshots', async () => {
    const consoleSpy = vi.spyOn(console, 'info')

    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game)
    const playerStat = await createPlayerStat(stat)
    await em.flush()

    const alias = playerStat.player.aliases[0]
    const handler = new FlushStatSnapshotsQueueHandler()
    await handler.add(new PlayerGameStatSnapshot().construct(alias, playerStat))
    await handler.add(new PlayerGameStatSnapshot().construct(alias, playerStat))

    await handler.handle()
    expect(consoleSpy).toHaveBeenCalledTimes(1)
    consoleSpy.mockClear()

    let snapshots: ClickHousePlayerGameStatSnapshot[] = []
    await vi.waitUntil(async () => {
      snapshots = await clickhouse.query({
        query: `SELECT * FROM player_game_stat_snapshots WHERE game_stat_id = ${stat.id} AND player_alias_id = ${alias.id}`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerGameStatSnapshot>())
      return snapshots.length === 2
    })

    // nothing to flush
    await handler.handle()
    expect(consoleSpy).not.toHaveBeenCalled()
  })

  it('should recalculate global value when flushing global stat snapshots', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await new GameStatFactory([apiKey.game]).global().state(() => ({
      globalValue: 0,
      defaultValue: 0,
      maxValue: 999,
      maxChange: 99
    })).one()

    const player1 = await new PlayerFactory([apiKey.game]).one()
    const playerStat1 = await new PlayerGameStatFactory().construct(player1, stat).state(() => ({ value: 10 })).one()

    const player2 = await new PlayerFactory([apiKey.game]).one()
    const playerStat2 = await new PlayerGameStatFactory().construct(player2, stat).state(() => ({ value: 25 })).one()

    await em.persist([stat, playerStat1, playerStat2]).flush()

    const handler = new FlushStatSnapshotsQueueHandler()
    await handler.add(new PlayerGameStatSnapshot().construct(player1.aliases[0], playerStat1))
    await handler.add(new PlayerGameStatSnapshot().construct(player2.aliases[0], playerStat2))

    await handler.handle()

    await vi.waitUntil(async () => {
      await em.refresh(stat)
      return stat.globalValue === 35
    })
  })
})
