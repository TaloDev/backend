import { Collection, Entity, EntityManager, Enum, Index, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/mysql'
import { Request, Required, ValidationCondition } from 'koa-clay'
import Game from './game'
import LeaderboardEntry from './leaderboard-entry'

export enum LeaderboardSortMode {
  DESC = 'desc',
  ASC = 'asc'
}

export enum LeaderboardRefreshInterval {
  NEVER = 'never',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly'
}

@Entity()
@Index({ properties: ['game', 'internalName'] })
export default class Leaderboard {
  @PrimaryKey()
  id!: number

  @Required({
    validation: async (val: unknown, req: Request): Promise<ValidationCondition[]> => {
      const { gameId, id } = req.params
      const duplicateInternalName = await (<EntityManager>req.ctx.em).getRepository(Leaderboard).findOne({
        id: { $ne: Number(id ?? null) },
        internalName: val as string,
        game: Number(gameId)
      })

      return [
        {
          check: !duplicateInternalName,
          error: `A leaderboard with the internalName '${val}' already exists`
        }
      ]
    }
  })
  @Property()
  internalName!: string

  @Required()
  @Property()
  name!: string

  @Required({
    validation: async (val: unknown): Promise<ValidationCondition[]> => {
      const keys = Object.keys(LeaderboardSortMode).map((key) => LeaderboardSortMode[key as keyof typeof LeaderboardSortMode])

      return [
        {
          check: keys.includes(val as LeaderboardSortMode),
          error: `Sort mode must be one of ${keys.join(', ')}`
        }
      ]
    }
  })
  @Enum(() => LeaderboardSortMode)
  sortMode: LeaderboardSortMode = LeaderboardSortMode.DESC

  @Required()
  @Property()
  unique!: boolean

  @Property()
  uniqueByProps: boolean = false

  @OneToMany(() => LeaderboardEntry, (entry) => entry.leaderboard)
  entries: Collection<LeaderboardEntry> = new Collection<LeaderboardEntry>(this)

  @ManyToOne(() => Game)
  game: Game

  @Required({
    validation: async (val: unknown): Promise<ValidationCondition[]> => {
      const keys = Object.keys(LeaderboardRefreshInterval).map((key) => LeaderboardRefreshInterval[key as keyof typeof LeaderboardRefreshInterval])

      return [
        {
          check: keys.includes(val as LeaderboardRefreshInterval),
          error: `Refresh interval must be one of ${keys.join(', ')}`
        }
      ]
    }
  })
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
      updatedAt: this.updatedAt
    }
  }
}
