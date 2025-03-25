import { v4 } from 'uuid'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import GameStat from './game-stat'
import PlayerGameStat from './player-game-stat'
import { EntityManager } from '@mikro-orm/mysql'
import ClickHouseEntity from '../lib/clickhouse/clickhouse-entity'
import PlayerAlias from './player-alias'

export type ClickHousePlayerGameStatSnapshot = {
  id: string
  player_alias_id: number
  game_stat_id: number
  change: number
  value: number
  global_value: number
  created_at: string
}

export default class PlayerGameStatSnapshot extends ClickHouseEntity<ClickHousePlayerGameStatSnapshot, [PlayerAlias, PlayerGameStat]> {
  id: string = v4()
  playerAlias!: PlayerAlias
  stat!: GameStat
  change: number = 0
  value!: number
  globalValue!: number
  createdAt: Date = new Date()

  construct(playerAlias: PlayerAlias, playerStat: PlayerGameStat): this {
    this.playerAlias = playerAlias
    this.stat = playerStat.stat

    this.value = playerStat.value
    this.globalValue = this.stat.globalValue

    return this
  }

  toInsertable(): ClickHousePlayerGameStatSnapshot {
    return {
      id: this.id,
      player_alias_id: this.playerAlias.id,
      game_stat_id: this.stat.id,
      change: this.change,
      value: this.value,
      global_value: this.globalValue,
      created_at: formatDateForClickHouse(this.createdAt)
    }
  }

  async hydrate(em: EntityManager, data: ClickHousePlayerGameStatSnapshot): Promise<this> {
    const playerAlias = await em.repo(PlayerAlias).findOneOrFail(data.player_alias_id)
    const playerStat = await em.repo(PlayerGameStat).findOneOrFail({
      player: playerAlias.player,
      stat: data.game_stat_id
    })

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
      createdAt: this.createdAt
    }
  }
}
