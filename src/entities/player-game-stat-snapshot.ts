import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import assert from 'node:assert'
import { v4 } from 'uuid'
import ClickHouseEntity from '../lib/clickhouse/clickhouse-entity'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import GameStat from './game-stat'
import PlayerAlias from './player-alias'
import PlayerGameStat from './player-game-stat'

export type ClickHousePlayerGameStatSnapshot = {
  id: string
  player_alias_id: number
  game_stat_id: number
  change: number
  value: number
  global_value: number
  created_at: string
}

export default class PlayerGameStatSnapshot extends ClickHouseEntity<
  ClickHousePlayerGameStatSnapshot,
  [PlayerAlias, PlayerGameStat]
> {
  id: string = v4()
  playerAlias!: PlayerAlias
  stat!: GameStat
  change: number = 0
  value!: number
  globalValue!: number
  createdAt: Date = new Date()

  static async massHydrate(
    em: EntityManager,
    data: ClickHousePlayerGameStatSnapshot[],
  ): Promise<PlayerGameStatSnapshot[]> {
    const playerAliases = await em.repo(PlayerAlias).find({
      id: {
        $in: data.map((snapshot) => snapshot.player_alias_id),
      },
    })

    const playerAliasesMap = new Map<number, PlayerAlias>()
    playerAliases.forEach((alias) => playerAliasesMap.set(alias.id, alias))

    const playerIds = Array.from(new Set(playerAliases.map((alias) => alias.player.id)))
    const gameStatIds = Array.from(new Set(data.map((snapshot) => snapshot.game_stat_id)))

    const playerStats = await em.repo(PlayerGameStat).find({
      player: {
        $in: playerIds,
      },
      stat: {
        $in: gameStatIds,
      },
    })

    const playerStatsMap = new Map<string, PlayerGameStat>()
    playerStats.forEach((stat) => playerStatsMap.set(`${stat.player.id}:${stat.stat.id}`, stat))

    return data
      .map((snapshotData) => {
        const playerAlias = playerAliasesMap.get(snapshotData.player_alias_id)
        /* v8 ignore start -- @preserve */
        if (!playerAlias) {
          captureException(
            new Error(`Player alias with ID ${snapshotData.player_alias_id} not found.`),
          )
          return null
        }
        /* v8 ignore stop -- @preserve */

        const playerStatKey = `${playerAlias.player.id}:${snapshotData.game_stat_id}`
        const playerGameStat = playerStatsMap.get(playerStatKey)
        /* v8 ignore start -- @preserve */
        if (!playerGameStat) {
          captureException(new Error(`PlayerGameStat with key ${playerStatKey} not found.`))
          return null
        }
        /* v8 ignore stop -- @preserve */

        const snapshot = new PlayerGameStatSnapshot()
        snapshot.construct(playerAlias, playerGameStat)
        snapshot.id = snapshotData.id
        snapshot.change = snapshotData.change
        snapshot.value = snapshotData.value
        snapshot.globalValue = snapshotData.global_value
        snapshot.createdAt = new Date(snapshotData.created_at)

        return snapshot
      })
      .filter((snapshot) => !!snapshot)
  }

  override construct(playerAlias: PlayerAlias, playerStat: PlayerGameStat): this {
    this.playerAlias = playerAlias
    this.stat = playerStat.stat

    this.value = playerStat.value
    this.globalValue = this.stat.globalValue

    return this
  }

  override toInsertable(): ClickHousePlayerGameStatSnapshot {
    return {
      id: this.id,
      player_alias_id: this.playerAlias.id,
      game_stat_id: this.stat.id,
      change: this.change,
      value: this.value,
      global_value: this.globalValue,
      created_at: formatDateForClickHouse(this.createdAt),
    }
  }

  override async hydrate(em: EntityManager, data: ClickHousePlayerGameStatSnapshot): Promise<this> {
    const playerStat = await em.repo(PlayerGameStat).findOneOrFail(
      {
        player: {
          aliases: {
            $in: [data.player_alias_id],
          },
        },
        stat: data.game_stat_id,
      },
      {
        populate: ['player.aliases'],
      },
    )

    const playerAlias = playerStat.player.aliases.find((alias) => alias.id === data.player_alias_id)
    assert(playerAlias)

    this.construct(playerAlias, playerStat)
    this.id = data.id
    this.change = data.change
    this.value = data.value
    this.globalValue = data.global_value
    this.createdAt = new Date(data.created_at)

    return this
  }

  toJSON() {
    return {
      playerAlias: this.playerAlias,
      change: this.change,
      value: this.value,
      globalValue: this.stat.global ? this.globalValue : undefined,
      createdAt: this.createdAt,
    }
  }
}
