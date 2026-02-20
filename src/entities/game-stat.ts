import { ClickHouseClient } from '@clickhouse/client'
import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Collection,
  OneToMany,
  Index,
  raw,
  EntityManager,
} from '@mikro-orm/mysql'
import { endOfDay, startOfDay } from 'date-fns'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import Game from './game'
import Player from './player'
import PlayerGameStat from './player-game-stat'

type GlobalValueMetrics = {
  minValue: number
  maxValue: number
  medianValue: number
  averageValue: number
  averageChange: number
}

type PlayerValueMetrics = {
  minValue: number
  maxValue: number
  medianValue: number
  averageValue: number
}

@Entity()
@Index({ properties: ['game', 'internalName'] })
export default class GameStat {
  @PrimaryKey()
  id!: number

  @Property()
  internalName!: string

  @Property()
  name!: string

  @Property()
  global!: boolean

  @Property({ type: 'double' })
  globalValue!: number

  @Property({ nullable: true, type: 'double' })
  maxChange: number | null = null

  @Property({ nullable: true, type: 'double' })
  minValue: number | null = null

  @Property({ nullable: true, type: 'double' })
  maxValue: number | null = null

  @Property({ type: 'double' })
  defaultValue!: number

  @Property()
  minTimeBetweenUpdates!: number

  @ManyToOne(() => Game)
  game: Game

  @OneToMany(() => PlayerGameStat, (playerStat) => playerStat.stat)
  playerStats: Collection<PlayerGameStat> = new Collection<PlayerGameStat>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  metrics?: {
    globalCount: number
    globalValue: GlobalValueMetrics
    playerValue: PlayerValueMetrics
  }

  static getIndexCacheKey(game: Game, wildcard = false) {
    let key = `stats-index-${game.id}`
    if (wildcard) key += '-*'
    return key
  }

  constructor(game: Game) {
    this.game = game
  }

  async recalculateGlobalValue({
    em,
    includeDevData,
  }: {
    em: EntityManager
    includeDevData: boolean
  }) {
    const qb = em
      .qb(PlayerGameStat, 'pgs')
      .select(raw('SUM(pgs.value) as total'))
      .where({ stat: this.id })

    if (!includeDevData) {
      qb.innerJoin('pgs.player', 'p').andWhere({ 'p.devBuild': false })
    }

    const result = await qb.execute<{ total: string | null }>('get')
    this.globalValue = Number(result?.total ?? 0)
  }

  async buildMetricsWhereConditions(
    startDate?: string,
    endDate?: string,
    player?: Player,
  ): Promise<string> {
    let whereConditions = `WHERE game_stat_id = ${this.id}`

    if (startDate) {
      // when using YYYY-MM-DD, use the start of the day
      const start = startDate.length === 10 ? startOfDay(new Date(startDate)) : new Date(startDate)
      whereConditions += ` AND created_at >= '${formatDateForClickHouse(start)}'`
    }
    if (endDate) {
      // when using YYYY-MM-DD, use the end of the day
      const end = endDate.length === 10 ? endOfDay(new Date(endDate)) : new Date(endDate)
      whereConditions += ` AND created_at <= '${formatDateForClickHouse(end)}'`
    }
    if (player) {
      await player.aliases.loadItems({ ref: true })
      const aliasIds = player.aliases.getIdentifiers()
      whereConditions += ` AND player_alias_id IN (${aliasIds.join(', ')})`
    }

    return whereConditions
  }

  async loadMetrics(
    clickhouse: ClickHouseClient,
    metricsStartDate?: string,
    metricsEndDate?: string,
  ): Promise<void> {
    const whereConditions = await this.buildMetricsWhereConditions(metricsStartDate, metricsEndDate)

    const [globalCount, globalValue] = await this.getGlobalValueMetrics(clickhouse, whereConditions)
    const playerValue = await this.getPlayerValueMetrics(clickhouse, whereConditions)

    this.metrics = {
      globalCount,
      globalValue,
      playerValue,
    }
  }

  async getGlobalValueMetrics(
    clickhouse: ClickHouseClient,
    whereConditions: string,
  ): Promise<[number, GlobalValueMetrics]> {
    const query = `
      SELECT
        count() as rawCount,
        min(global_value) as minValue,
        max(global_value) as maxValue,
        median(global_value) as medianValue,
        avg(global_value) as averageValue,
        avg(change) as averageChange
      FROM player_game_stat_snapshots
      ${whereConditions}
    `

    const res = await clickhouse
      .query({
        query: query,
        format: 'JSONEachRow',
      })
      .then((res) =>
        res.json<{
          rawCount: string | number
          minValue: number
          maxValue: number
          medianValue: number | null
          averageValue: number | null
          averageChange: number | null
        }>(),
      )

    const { rawCount, minValue, maxValue, medianValue, averageValue, averageChange } = res[0]

    return [
      Number(rawCount),
      {
        minValue: minValue || this.defaultValue,
        maxValue: maxValue || this.defaultValue,
        medianValue: medianValue ?? this.defaultValue,
        averageValue: averageValue ?? this.defaultValue,
        averageChange: averageChange ?? 0,
      },
    ]
  }

  async getPlayerValueMetrics(
    clickhouse: ClickHouseClient,
    whereConditions: string,
  ): Promise<PlayerValueMetrics> {
    const query = `
      SELECT
        min(value) as minValue,
        max(value) as maxValue,
        median(value) as medianValue,
        avg(value) as averageValue
      FROM player_game_stat_snapshots
      ${whereConditions}
    `

    const res = await clickhouse
      .query({
        query: query,
        format: 'JSONEachRow',
      })
      .then((res) =>
        res.json<{
          minValue: number
          maxValue: number
          medianValue: number | null
          averageValue: number | null
        }>(),
      )

    const { minValue, maxValue, medianValue, averageValue } = res[0]

    return {
      minValue: minValue || this.defaultValue,
      maxValue: maxValue || this.defaultValue,
      medianValue: medianValue ?? this.defaultValue,
      averageValue: averageValue ?? this.defaultValue,
    }
  }

  toJSON() {
    return {
      id: this.id,
      internalName: this.internalName,
      name: this.name,
      global: this.global,
      globalValue: this.globalValue,
      metrics: this.metrics,
      defaultValue: this.defaultValue,
      maxChange: this.maxChange,
      minValue: this.minValue,
      maxValue: this.maxValue,
      minTimeBetweenUpdates: this.minTimeBetweenUpdates,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
