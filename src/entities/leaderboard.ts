import { Collection, Entity, EntityManager, Enum, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/mysql'
import { Request, Required, ValidationCondition } from 'koa-clay'
import Game from './game'
import LeaderboardEntry from './leaderboard-entry'

export enum LeaderboardSortMode {
  DESC = 'desc',
  ASC = 'asc'
}

@Entity()
export default class Leaderboard {
  @PrimaryKey()
  id: number

  @Required({
    validation: async (val: unknown, req: Request): Promise<ValidationCondition[]> => {
      const { gameId, id } = req.params
      const duplicateInternalName = await (<EntityManager>req.ctx.em).getRepository(Leaderboard).findOne({
        id: { $ne: Number(id ?? null) },
        internalName: val,
        game: Number(gameId)
      })

      return [
        {
          check: !duplicateInternalName,
          error: `A leaderboard with the internalName ${val} already exists`
        }
      ]
    }
  })
  @Property()
  internalName: string

  @Required()
  @Property()
  name: string

  @Required({
    validation: async (val: unknown): Promise<ValidationCondition[]> => {
      const keys = Object.keys(LeaderboardSortMode).map((key) => LeaderboardSortMode[key])

      return [
        {
          check: keys.includes(val),
          error: `Sort mode must be one of ${keys.join(', ')}`
        }
      ]
    }
  })
  @Enum(() => LeaderboardSortMode)
  sortMode: LeaderboardSortMode = LeaderboardSortMode.DESC

  @Required()
  @Property()
  unique: boolean

  @OneToMany(() => LeaderboardEntry, (entry) => entry.leaderboard)
  entries: Collection<LeaderboardEntry> = new Collection<LeaderboardEntry>(this)

  @ManyToOne(() => Game)
  game: Game

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(game: Game) {
    this.game = game
  }

  toJSON() {
    return {
      id: this.id,
      internalName: this.internalName,
      name: this.name,
      sortMode: this.sortMode,
      unique: this.unique,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
