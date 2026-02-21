import { Entity, ManyToOne, OneToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import LeaderboardEntry from './leaderboard-entry'
import SteamworksLeaderboardMapping from './steamworks-leaderboard-mapping'

@Entity()
export class SteamworksLeaderboardEntry {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => SteamworksLeaderboardMapping, {
    deleteRule: 'cascade',
    fieldNames: ['steamworks_leaderboard_id', 'leaderboard_id'],
  })
  steamworksLeaderboard: SteamworksLeaderboardMapping

  @OneToOne(() => LeaderboardEntry, { nullable: true })
  leaderboardEntry: LeaderboardEntry | null

  @Property()
  steamUserId: string

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor({
    steamworksLeaderboard,
    leaderboardEntry,
    steamUserId,
  }: {
    steamworksLeaderboard: SteamworksLeaderboardMapping
    leaderboardEntry: LeaderboardEntry | null
    steamUserId: string
  }) {
    this.steamworksLeaderboard = steamworksLeaderboard
    this.leaderboardEntry = leaderboardEntry
    this.steamUserId = steamUserId
  }
}
