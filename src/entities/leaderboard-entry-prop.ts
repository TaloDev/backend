import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import LeaderboardEntry from './leaderboard-entry'
import { MAX_KEY_LENGTH } from './prop'

@Entity()
export default class LeaderboardEntryProp {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => LeaderboardEntry, { deleteRule: 'cascade' })
  leaderboardEntry: LeaderboardEntry

  @Property({ length: MAX_KEY_LENGTH })
  key: string

  @Property({ type: 'text' })
  value: string

  @Property()
  createdAt: Date = new Date()

  constructor(leaderboardEntry: LeaderboardEntry, key: string, value: string) {
    this.leaderboardEntry = leaderboardEntry
    this.key = key
    this.value = value
  }

  toJSON() {
    return {
      key: this.key,
      value: this.value
    }
  }
}
