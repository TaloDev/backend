import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es'
import LeaderboardEntry from './leaderboard-entry.js'
import SteamworksLeaderboardMapping from './steamworks-leaderboard-mapping.js'

@Entity()
@Unique({ properties: ['steamworksLeaderboard', 'leaderboardEntry'] })
export class SteamworksLeaderboardEntry {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => SteamworksLeaderboardMapping, {
    deleteRule: 'cascade',
    fieldNames: ['steamworks_leaderboard_id', 'leaderboard_id', 'integration_id'],
    referencedColumnNames: ['steamworks_leaderboard_id', 'leaderboard_id', 'integration_id'],
  })
  steamworksLeaderboard: SteamworksLeaderboardMapping

  @ManyToOne(() => LeaderboardEntry, { nullable: true, deleteRule: 'set null' })
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
