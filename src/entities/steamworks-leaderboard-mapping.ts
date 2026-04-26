import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import { PrimaryKeyProp } from '@mikro-orm/mysql'
import Leaderboard from './leaderboard'

@Entity()
export default class SteamworksLeaderboardMapping {
  [PrimaryKeyProp]?: ['steamworksLeaderboardId', 'leaderboard']

  @PrimaryKey()
  steamworksLeaderboardId: number

  @ManyToOne(() => Leaderboard, { primary: true, deleteRule: 'cascade', nullable: false })
  leaderboard: Leaderboard

  @Property()
  createdAt: Date = new Date()

  constructor(steamworksLeaderboardId: number, leaderboard: Leaderboard) {
    this.steamworksLeaderboardId = steamworksLeaderboardId
    this.leaderboard = leaderboard
  }
}
