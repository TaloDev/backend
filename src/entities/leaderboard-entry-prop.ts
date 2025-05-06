import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import LeaderboardEntry from './leaderboard-entry'
import { MAX_KEY_LENGTH, MAX_VALUE_LENGTH } from './prop'

@Entity()
export default class LeaderboardEntryProp {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => LeaderboardEntry)
  leaderboardEntry: LeaderboardEntry

  @Property({ length: MAX_KEY_LENGTH })
  key: string

  @Property({ length: MAX_VALUE_LENGTH })
  value: string

  @Property()
  createdAt: Date = new Date()

  constructor(leaderboardEntry: LeaderboardEntry, key: string, value: string) {
    this.leaderboardEntry = leaderboardEntry
    this.key = key
    this.value = value
  }
}
