import { v4 } from 'uuid'
import ClickHouseEntity from '../lib/clickhouse/clickhouse-entity.js'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime.js'
import Game from './game.js'
import Player from './player.js'

export type PlayerSessionRef = {
  id: string
  startedAt: Date
}

export type ClickHousePlayerSession = {
  id: string
  player_id: string
  game_id: number
  dev_build: boolean
  started_at: string
  ended_at: string | null
}

export default class PlayerSession extends ClickHouseEntity<ClickHousePlayerSession, [Player]> {
  id: string = v4()
  player!: Player
  game!: Game
  startedAt: Date = new Date()
  endedAt: Date | null = null

  override construct(player: Player): this {
    this.player = player
    this.game = player.game

    return this
  }

  override toInsertable(): ClickHousePlayerSession {
    return {
      id: this.id,
      player_id: this.player.id,
      game_id: this.game.id,
      dev_build: this.player.devBuild,
      started_at: formatDateForClickHouse(this.startedAt),
      ended_at: this.endedAt ? formatDateForClickHouse(this.endedAt) : null,
    }
  }

  endSession() {
    this.endedAt = new Date()
  }

  toJSON() {
    return {
      player: this.player,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
    }
  }
}
