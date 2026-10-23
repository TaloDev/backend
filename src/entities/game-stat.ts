import type { Redis } from 'ioredis'
import { ClickHouseClient } from '@clickhouse/client'
import { Entity, ManyToOne, PrimaryKey, Property, OneToMany, Index } from '@mikro-orm/decorators/es'
import { Collection, raw, EntityManager } from '@mikro-orm/mysql'
import { endOfDay, startOfDay } from 'date-fns'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime.js'
import Game from './game.js'
import PlayerGameStat from './player-game-stat.js'
import Player from './player.js'

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

const GLOBAL_VALUE_AGGREGATES = `
        count() as rawCount,
        min(global_value) as minGlobalValue,
        max(global_value) as maxGlobalValue,
        median(global_value) as medianGlobalValue,
        avg(global_value) as averageGlobalValue,
        avg(change) as averageChange`

const PLAYER_VALUE_AGGREGATES = `
        min(value) as minValue,
        max(value) as maxValue,
        median(value) as medianValue,
        avg(value) as averageValue`

type GlobalValueRow = {
  rawCount: string | number
  minGlobalValue: number | null
  maxGlobalValue: number | null
  medianGlobalValue: number | null
  averageGlobalValue: number | null
  averageChange: number | null
}

type PlayerValueRow = {
  minValue: number | null
  maxValue: number | null
  medianValue: number | null
  averageValue: number | null
}

type StatMetricsRow = GlobalValueRow & PlayerValueRow & { game_stat_id: number }

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

  static getGlobalValueCacheKey(id: number) {
    return `stat:global-value:${id}`
  }

  async incrementGlobalValue(redis: Redis, change: number) {
    const key = GameStat.getGlobalValueCacheKey(this.id)
    await redis.setnx(key, this.globalValue)
    this.globalValue = Number(await redis.incrbyfloat(key, change))
  }

  async getGlobalValueFromCache(redis: Redis) {
    const key = GameStat.getGlobalValueCacheKey(this.id)
    const value = await redis.get(key)
    if (value !== null) {
      this.globalValue = Number(value)
    }

    return this.globalValue
  }

  constructor(game: Game) {
    this.game = game
  }

  async recalculateGlobalValue({
    em,
    includeDevData,
    devOnly,
  }: {
    em: EntityManager
    includeDevData: boolean
    devOnly?: boolean
  }) {
    const qb = em
      .qb(PlayerGameStat, 'pgs')
      .select(raw('SUM(pgs.value) as total'))
      .where({ stat: this.id })

    if (!includeDevData || devOnly) {
      qb.innerJoin('pgs.player', 'p')
      if (!includeDevData) {
        qb.andWhere({ player: { devBuild: false } })
      }
      if (devOnly) {
        qb.andWhere({ player: { devBuild: true } })
      }
    }

    const result = await qb.execute<{ total: string | null }>('get')
    this.globalValue = Number(result?.total ?? 0)
  }

  private static buildMetricsWhere({
    gameStatFilter,
    startDate,
    endDate,
    aliasIds,
    includeDevData,
  }: {
    gameStatFilter: string
    startDate?: string
    endDate?: string
    aliasIds?: number[]
    includeDevData?: boolean
  }) {
    const conditions = [gameStatFilter]

    if (startDate) {
      // when using YYYY-MM-DD, use the start of the day
      const start = startDate.length === 10 ? startOfDay(new Date(startDate)) : new Date(startDate)
      conditions.push(`created_at >= '${formatDateForClickHouse(start)}'`)
    }
    if (endDate) {
      // when using YYYY-MM-DD, use the end of the day
      const end = endDate.length === 10 ? endOfDay(new Date(endDate)) : new Date(endDate)
      conditions.push(`created_at <= '${formatDateForClickHouse(end)}'`)
    }
    if (aliasIds) {
      conditions.push(`player_alias_id IN (${aliasIds.join(', ')})`)
    }
    if (!includeDevData) {
      conditions.push('dev_build = false')
    }

    return `WHERE ${conditions.join(' AND ')}`
  }

  async buildMetricsWhereConditions({
    startDate,
    endDate,
    player,
    includeDevData,
  }: {
    startDate?: string
    endDate?: string
    player?: Player
    includeDevData?: boolean
  }) {
    let aliasIds: number[] | undefined

    if (player) {
      await player.aliases.loadItems({ ref: true })
      aliasIds = player.aliases.getIdentifiers()
    }

    return GameStat.buildMetricsWhere({
      gameStatFilter: `game_stat_id = ${this.id}`,
      startDate,
      endDate,
      aliasIds,
      includeDevData,
    })
  }

  async loadMetrics({
    clickhouse,
    startDate,
    endDate,
    includeDevData,
  }: {
    clickhouse: ClickHouseClient
    startDate?: string
    endDate?: string
    includeDevData?: boolean
  }) {
    const whereConditions = await this.buildMetricsWhereConditions({
      startDate,
      endDate,
      includeDevData,
    })

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
      SELECT${GLOBAL_VALUE_AGGREGATES}
      FROM player_game_stat_snapshots
      ${whereConditions}
    `

    const rows = await clickhouse
      .query({
        query: query,
        format: 'JSONEachRow',
      })
      .then((res) => res.json<GlobalValueRow>())

    return [Number(rows[0].rawCount), GameStat.buildGlobalValueMetrics(rows[0], this.defaultValue)]
  }

  private static buildGlobalValueMetrics(
    row: GlobalValueRow | undefined,
    defaultValue: number,
  ): GlobalValueMetrics {
    return {
      minValue: row?.minGlobalValue || defaultValue,
      maxValue: row?.maxGlobalValue || defaultValue,
      medianValue: row?.medianGlobalValue ?? defaultValue,
      averageValue: row?.averageGlobalValue ?? defaultValue,
      averageChange: row?.averageChange ?? 0,
    }
  }

  private static buildPlayerValueMetrics(
    row: PlayerValueRow | undefined,
    defaultValue: number,
  ): PlayerValueMetrics {
    return {
      minValue: row?.minValue || defaultValue,
      maxValue: row?.maxValue || defaultValue,
      medianValue: row?.medianValue ?? defaultValue,
      averageValue: row?.averageValue ?? defaultValue,
    }
  }

  static async loadMetricsForStats({
    stats,
    clickhouse,
    startDate,
    endDate,
    includeDevData,
  }: {
    stats: GameStat[]
    clickhouse: ClickHouseClient
    startDate?: string
    endDate?: string
    includeDevData?: boolean
  }) {
    if (stats.length === 0) {
      return
    }

    const whereConditions = GameStat.buildMetricsWhere({
      gameStatFilter: 'game_stat_id IN {ids:Array(UInt32)}',
      startDate,
      endDate,
      includeDevData,
    })

    const query = `
      SELECT
        game_stat_id,${GLOBAL_VALUE_AGGREGATES},${PLAYER_VALUE_AGGREGATES}
      FROM player_game_stat_snapshots
      ${whereConditions}
      GROUP BY game_stat_id
    `

    const rows = await clickhouse
      .query({
        query,
        query_params: { ids: stats.map((stat) => stat.id) },
        format: 'JSONEachRow',
      })
      .then((res) => res.json<StatMetricsRow>())

    const rowsByStatId = new Map(rows.map((row) => [row.game_stat_id, row]))

    stats.forEach((stat) => {
      const row = rowsByStatId.get(stat.id)

      stat.metrics = {
        globalCount: Number(row?.rawCount ?? 0),
        globalValue: GameStat.buildGlobalValueMetrics(row, stat.defaultValue),
        playerValue: GameStat.buildPlayerValueMetrics(row, stat.defaultValue),
      }
    })
  }

  async getPlayerValueMetrics(
    clickhouse: ClickHouseClient,
    whereConditions: string,
  ): Promise<PlayerValueMetrics> {
    const query = `
      SELECT${PLAYER_VALUE_AGGREGATES}
      FROM player_game_stat_snapshots
      ${whereConditions}
    `

    const rows = await clickhouse
      .query({
        query: query,
        format: 'JSONEachRow',
      })
      .then((res) => res.json<PlayerValueRow>())

    return GameStat.buildPlayerValueMetrics(rows[0], this.defaultValue)
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
