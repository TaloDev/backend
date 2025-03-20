import { v4 } from 'uuid'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import GameStat from './game-stat'
import Player from './player'
import PlayerGameStat from './player-game-stat'
import { EntityManager } from '@mikro-orm/mysql'
import ClickHouseEntity from '../lib/clickhouse/clickhouse-entity'

export type ClickHousePlayerGameStatSnapshot = {
  id: string
  player_id: string
  game_stat_id: number
  change: number
  value: number
  global_value: number
  created_at: string
}

export default class PlayerGameStatSnapshot extends ClickHouseEntity<ClickHousePlayerGameStatSnapshot, [], [PlayerGameStat]> {
  id: string = v4()
  player!: Player
  stat!: GameStat
  change: number = 0
  value!: number
  globalValue!: number
  createdAt: Date = new Date()

  construct(playerStat: PlayerGameStat): this {
    this.player = playerStat.player
    this.stat = playerStat.stat

    this.value = playerStat.value
    this.globalValue = this.stat.globalValue

    return this
  }

  toInsertable(): ClickHousePlayerGameStatSnapshot {
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

  async hydrate(em: EntityManager, data: ClickHousePlayerGameStatSnapshot): Promise<this> {
    const playerStat = await em.findOneOrFail(PlayerGameStat, { player: data.player_id, stat: data.game_stat_id })

    this.construct(playerStat)
    this.id = data.id
    this.change = data.change
    this.value = data.value
    this.globalValue = data.global_value
    this.createdAt = new Date(data.created_at)

    return this
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
