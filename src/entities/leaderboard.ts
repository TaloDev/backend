import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/es'
import { Collection, EntityManager, OrderDefinition } from '@mikro-orm/mysql'
import { isThisMonth, isThisWeek, isThisYear, isToday } from 'date-fns'
import Game from './game.js'
import LeaderboardEntry, { ascOrderIndexName, descOrderIndexName } from './leaderboard-entry.js'

export enum LeaderboardSortMode {
  DESC = 'desc',
  ASC = 'asc',
}

export enum LeaderboardRefreshInterval {
  NEVER = 'never',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

const refreshCheckers: Record<LeaderboardRefreshInterval, (d: Date) => boolean> = {
  [LeaderboardRefreshInterval.NEVER]: () => true,
  [LeaderboardRefreshInterval.DAILY]: (d) => isToday(d),
  [LeaderboardRefreshInterval.WEEKLY]: (d) => isThisWeek(d, { weekStartsOn: 1 }),
  [LeaderboardRefreshInterval.MONTHLY]: (d) => isThisMonth(d),
  [LeaderboardRefreshInterval.YEARLY]: (d) => isThisYear(d),
}

@Entity()
@Index({ properties: ['game', 'internalName'] })
export default class Leaderboard {
  @PrimaryKey()
  id!: number

  @Property()
  internalName!: string

  @Property()
  name!: string

  @Enum(() => LeaderboardSortMode)
  sortMode: LeaderboardSortMode = LeaderboardSortMode.DESC

  @Property()
  unique!: boolean

  @Property()
  uniqueByProps: boolean = false

  @OneToMany(() => LeaderboardEntry, (entry) => entry.leaderboard)
  entries: Collection<LeaderboardEntry> = new Collection<LeaderboardEntry>(this)

  @ManyToOne(() => Game)
  game: Game

  @Enum(() => LeaderboardRefreshInterval)
  refreshInterval: LeaderboardRefreshInterval = LeaderboardRefreshInterval.NEVER

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(game: Game) {
    this.game = game
  }

  getEntriesCacheKey(wildcard = false) {
    let key = `leaderboard-entries-${this.id}`
    if (wildcard) key += '-*'
    return key
  }

  isDateInCurrentPeriod(date: Date) {
    return refreshCheckers[this.refreshInterval](date)
  }

  getEntryOrder(): OrderDefinition<LeaderboardEntry> {
    return {
      score: this.sortMode,
      createdAt: 'asc',
      id: 'asc',
    }
  }

  getBaseEntryFilters(includeDevData: boolean): {
    leaderboard: Leaderboard
    hidden: boolean
    deletedAt: Date | null
    playerAlias?: { player: { devBuild: boolean } }
  } {
    return {
      leaderboard: this,
      hidden: false,
      deletedAt: null,
      ...(includeDevData ? {} : { playerAlias: { player: { devBuild: false } } }),
    }
  }

  // position = number of entries sorting before this one, per getEntryOrder()
  // two separate range counts so both can use the score indexes
  async getEntryPosition({
    em,
    entry,
    includeDevData,
  }: {
    em: EntityManager
    entry: LeaderboardEntry
    includeDevData: boolean
  }) {
    const asc = this.sortMode === LeaderboardSortMode.ASC

    // rounded to second precision to match MySQL datetime storage
    const createdAt = new Date(Math.round(entry.createdAt.getTime() / 1000) * 1000)

    const betterScore = await em.repo(LeaderboardEntry).count(
      {
        ...this.getBaseEntryFilters(includeDevData),
        score: asc ? { $lt: entry.score } : { $gt: entry.score },
      },
      // the dev_build join makes the planner skip the order index
      { indexHint: `force index(${asc ? ascOrderIndexName : descOrderIndexName})` },
    )

    const betterTie = await em.repo(LeaderboardEntry).count({
      ...this.getBaseEntryFilters(includeDevData),
      score: entry.score,
      $or: [{ createdAt: { $lt: createdAt } }, { createdAt, id: { $lt: entry.id } }],
    })

    return betterScore + betterTie
  }

  async findEntryWithProps({
    em,
    playerAliasId,
    props,
    onlyDeleted = false,
  }: {
    em: EntityManager
    playerAliasId: number
    props: { key: string; value: string }[]
    onlyDeleted?: boolean
  }) {
    return em.repo(LeaderboardEntry).findOne({
      leaderboard: this,
      playerAlias: playerAliasId,
      deletedAt: onlyDeleted ? { $ne: null } : null,
      propsDigest: LeaderboardEntry.createPropsDigest(props),
    })
  }

  toJSON() {
    return {
      id: this.id,
      internalName: this.internalName,
      name: this.name,
      sortMode: this.sortMode,
      unique: this.unique,
      uniqueByProps: this.uniqueByProps,
      refreshInterval: this.refreshInterval,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
