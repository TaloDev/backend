import { Collection, Entity, Enum, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core'
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

  @Property()
  internalName: string

  @Property()
  name: string

  @Enum(() => LeaderboardSortMode)
  sortMode: LeaderboardSortMode = LeaderboardSortMode.DESC

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
      createdAt: this.createdAt
    }
  }
}
