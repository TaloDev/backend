import { Cascade, Entity, ManyToOne, PrimaryKey, PrimaryKeyProp, Property } from '@mikro-orm/mysql'
import Leaderboard from './leaderboard.js'

@Entity()
export default class SteamworksLeaderboardMapping {
  [PrimaryKeyProp]?: ['steamworksLeaderboardId', 'leaderboard']

  @PrimaryKey()
  steamworksLeaderboardId: number

  @ManyToOne(() => Leaderboard, { primary: true, cascade: [Cascade.REMOVE], nullable: false })
  leaderboard: Leaderboard

  @Property()
  createdAt: Date = new Date()

  constructor(steamworksLeaderboardId: number, leaderboard: Leaderboard) {
    this.steamworksLeaderboardId = steamworksLeaderboardId
    this.leaderboard = leaderboard
  }
}
