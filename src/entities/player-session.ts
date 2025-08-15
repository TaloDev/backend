import { v4 } from 'uuid'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import { EntityManager } from '@mikro-orm/mysql'
import ClickHouseEntity from '../lib/clickhouse/clickhouse-entity'
import Player from './player'
import Game from './game'
import { getResultCacheOptions } from '../lib/perf/getResultCacheOptions'

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

  construct(player: Player): this {
    this.player = player
    this.game = player.game

    return this
  }

  toInsertable(): ClickHousePlayerSession {
    return {
      id: this.id,
      player_id: this.player.id,
      game_id: this.game.id,
      dev_build: this.player.devBuild,
      started_at: formatDateForClickHouse(this.startedAt),
      ended_at: this.endedAt ? formatDateForClickHouse(this.endedAt) : null
    }
  }

  endSession() {
    this.endedAt = new Date()
    // we'll be inserting a new row so we need a new id
    this.id = v4()
  }

  async hydrate(em: EntityManager, data: ClickHousePlayerSession): Promise<this> {
    const player = await em.repo(Player).findOneOrFail(data.player_id, {
      ...getResultCacheOptions(`hydrate-player-session-${data.player_id}`),
      populate: ['game']
    })

    this.construct(player)
    this.id = data.id
    this.startedAt = new Date(data.started_at)
    this.endedAt = data.ended_at ? new Date(data.ended_at) : null

    return this
  }

  toJSON() {
    return {
      player: this.player,
      startedAt: this.startedAt,
      endedAt: this.endedAt
    }
  }
}
