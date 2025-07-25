import { EntityManager, Entity, ManyToOne, PrimaryKey, Property, Collection, OneToMany, Index } from '@mikro-orm/mysql'
import { Request, Required, ValidationCondition } from 'koa-clay'
import Game from './game'
import PlayerGameStat from './player-game-stat'
import { ClickHouseClient } from '@clickhouse/client'
import Player from './player'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import { endOfDay } from 'date-fns'

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
export default class GameStat {
  @PrimaryKey()
  id!: number

  @Required({
    validation: async (val: unknown, req: Request): Promise<ValidationCondition[]> => {
      const { gameId, id } = req.params
      const duplicateInternalName = await (<EntityManager>req.ctx.em).getRepository(GameStat).findOne({
        id: { $ne: Number(id ?? null) },
        internalName: val as string,
        game: Number(gameId)
      })

      return [
        {
          check: !duplicateInternalName,
          error: `A stat with the internalName '${val}' already exists`
        }
      ]
    }
  })
  @Index()
  @Property()
  internalName!: string

  @Required()
  @Property()
  name!: string

  @Required()
  @Property()
  global!: boolean

  @Property({ type: 'double' })
  globalValue!: number

  hydratedGlobalValue!: number

  @Required({
    validation: async (value: unknown): Promise<ValidationCondition[]> => [{
      check: value !== null ? (value as number) > 0 : true,
      error: 'maxChange must be greater than 0'
    }]
  })
  @Property({ nullable: true, type: 'double' })
  maxChange: number | null = null

  @Required({
    validation: async (value: unknown, req: Request): Promise<ValidationCondition[]> => [{
      check: req.body.maxValue ? (value as number) < (req.body.maxValue as number) : true,
      error: 'minValue must be less than maxValue'
    }]
  })
  @Property({ nullable: true, type: 'double' })
  minValue: number | null = null

  @Required({
    validation: async (value: unknown, req: Request): Promise<ValidationCondition[]> => [{
      check: req.body.minValue ? (value as number) > (req.body.minValue as number) : true,
      error: 'maxValue must be greater than minValue'
    }]
  })
  @Property({ nullable: true, type: 'double' })
  maxValue: number | null = null

  @Required({
    validation: async (value: unknown, req: Request): Promise<ValidationCondition[]> => [{
      check: value !== null && (value as number) >= (req.body.minValue ?? -Infinity) && (value as number) <= (req.body.maxValue ?? Infinity),
      error: 'defaultValue must be between minValue and maxValue'
    }]
  })
  @Property({ type: 'double' })
  defaultValue!: number

  @Required()
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

  metrics?: { globalCount: number, globalValue: GlobalValueMetrics, playerValue: PlayerValueMetrics }

  constructor(game: Game) {
    this.game = game
  }

  async recalculateGlobalValue(includeDevData: boolean): Promise<void> {
    this.hydratedGlobalValue = this.globalValue

    if (includeDevData) return

    const playerStats = await this.playerStats.loadItems({ populate: ['player'] })

    this.hydratedGlobalValue -= playerStats
      .filter((playerStat) => playerStat.player.devBuild)
      .reduce((acc, curr) => acc += curr.value, 0)
  }

  async buildMetricsWhereConditions(startDate?: string, endDate?: string, player?: Player): Promise<string> {
    let whereConditions = `WHERE game_stat_id = ${this.id}`

    if (startDate) {
      whereConditions += ` AND created_at >= '${formatDateForClickHouse(new Date(startDate))}'`
    }
    if (endDate) {
      // when using YYYY-MM-DD, use the end of the day
      const end = endDate.length === 10 ? endOfDay(new Date(endDate)) : new Date(endDate)
      whereConditions += ` AND created_at <= '${formatDateForClickHouse(end)}'`
    }
    if (player) {
      await player.aliases.loadItems()
      const aliasIds = player.aliases.getIdentifiers()
      whereConditions += ` AND player_alias_id IN (${aliasIds.join(', ')})`
    }

    return whereConditions
  }

  async loadMetrics(clickhouse: ClickHouseClient, metricsStartDate?: string, metricsEndDate?: string): Promise<void> {
    const whereConditions = await this.buildMetricsWhereConditions(metricsStartDate, metricsEndDate)

    const [globalCount, globalValue] = await this.getGlobalValueMetrics(clickhouse, whereConditions)
    const playerValue = await this.getPlayerValueMetrics(clickhouse, whereConditions)

    this.metrics = {
      globalCount,
      globalValue,
      playerValue
    }
  }

  async getGlobalValueMetrics(
    clickhouse: ClickHouseClient,
    whereConditions: string
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

    const res = await clickhouse.query({
      query: query,
      format: 'JSONEachRow'
    }).then((res) => res.json<{
      rawCount: string | number
      minValue: number
      maxValue: number
      medianValue: number | null
      averageValue: number | null
      averageChange: number | null
    }>())

    const {
      rawCount,
      minValue,
      maxValue,
      medianValue,
      averageValue,
      averageChange
    } = res[0]

    return [
      Number(rawCount),
      {
        minValue: minValue || this.defaultValue,
        maxValue: maxValue || this.defaultValue,
        medianValue: medianValue ?? this.defaultValue,
        averageValue: averageValue ?? this.defaultValue,
        averageChange: averageChange ?? 0
      }
    ]
  }

  async getPlayerValueMetrics(
    clickhouse: ClickHouseClient,
    whereConditions: string
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

    const res = await clickhouse.query({
      query: query,
      format: 'JSONEachRow'
    }).then((res) => res.json<{
      minValue: number
      maxValue: number
      medianValue: number | null
      averageValue: number | null
    }>())

    const {
      minValue,
      maxValue,
      medianValue,
      averageValue
    } = res[0]

    return {
      minValue: minValue || this.defaultValue,
      maxValue: maxValue || this.defaultValue,
      medianValue: medianValue ?? this.defaultValue,
      averageValue: averageValue ?? this.defaultValue
    }
  }

  toJSON() {
    return {
      id: this.id,
      internalName: this.internalName,
      name: this.name,
      global: this.global,
      globalValue: this.hydratedGlobalValue ?? this.globalValue,
      metrics: this.metrics,
      defaultValue: this.defaultValue,
      maxChange: this.maxChange,
      minValue: this.minValue,
      maxValue: this.maxValue,
      minTimeBetweenUpdates: this.minTimeBetweenUpdates,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
