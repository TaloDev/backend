import {
  Collection,
  Entity,
  EntityManager,
  Enum,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/mysql'
import Game from './game'
import LeaderboardEntry from './leaderboard-entry'

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

  async findEntryWithProps({
    em,
    playerAliasId,
    props,
  }: {
    em: EntityManager
    playerAliasId: number
    props: { key: string; value: string }[]
  }): Promise<LeaderboardEntry | null> {
    return em.repo(LeaderboardEntry).findOne({
      leaderboard: this,
      playerAlias: playerAliasId,
      deletedAt: null,
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
