import { v4 } from 'uuid'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import GameStat from './game-stat'
import Player from './player'
import PlayerGameStat from './player-game-stat'
import { EntityManager } from '@mikro-orm/mysql'

export type ClickHousePlayerGameStatSnapshot = {
  id: string
  player_id: string
  game_stat_id: number
  change: number
  value: number
  global_value: number
  created_at: string
}

export default class PlayerGameStatSnapshot {
  id: string = v4()
  player: Player
  stat: GameStat
  change: number = 0
  value: number
  globalValue: number
  createdAt: Date = new Date()

  constructor(playerStat: PlayerGameStat) {
    this.player = playerStat.player
    this.stat = playerStat.stat

    this.value = playerStat.value
    this.globalValue = this.stat.globalValue
  }

  getInsertableData(): ClickHousePlayerGameStatSnapshot {
    return {
      id: this.id,
      player_id: this.player.id,
      game_stat_id: this.stat.id,
      change: this.change,
      value: this.value,
      global_value: this.globalValue,
      created_at: formatDateForClickHouse(this.createdAt)
    }
  }

  toJSON() {
    return {
      change: this.change,
      value: this.value,
      globalValue: this.globalValue,
      createdAt: this.createdAt
    }
  }
}

export async function createPlayerGameStatSnapshotFromClickHouse(
  em: EntityManager,
  data: ClickHousePlayerGameStatSnapshot
): Promise<PlayerGameStatSnapshot> {
  const playerStat = await em.findOneOrFail(PlayerGameStat, { player: data.player_id, stat: data.game_stat_id })

  const snapshot = new PlayerGameStatSnapshot(playerStat)
  snapshot.id = data.id
  snapshot.change = data.change
  snapshot.value = data.value
  snapshot.globalValue = data.global_value
  snapshot.createdAt = new Date(data.created_at)

  return snapshot
}
