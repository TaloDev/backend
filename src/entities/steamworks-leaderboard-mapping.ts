import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import { PrimaryKeyProp } from '@mikro-orm/mysql'
import Integration from './integration.js'
import Leaderboard from './leaderboard.js'

@Entity()
export default class SteamworksLeaderboardMapping {
  [PrimaryKeyProp]?: ['steamworksLeaderboardId', 'leaderboard', 'integration']

  @PrimaryKey()
  steamworksLeaderboardId: number

  @ManyToOne(() => Leaderboard, { primary: true, deleteRule: 'cascade', nullable: false })
  leaderboard: Leaderboard

  @ManyToOne(() => Integration, { primary: true, deleteRule: 'cascade', nullable: false })
  integration: Integration

  @Property()
  createdAt: Date = new Date()

  constructor({
    steamworksLeaderboardId,
    leaderboard,
    integration,
  }: {
    steamworksLeaderboardId: number
    leaderboard: Leaderboard
    integration: Integration
  }) {
    this.steamworksLeaderboardId = steamworksLeaderboardId
    this.leaderboard = leaderboard
    this.integration = integration
  }
}
