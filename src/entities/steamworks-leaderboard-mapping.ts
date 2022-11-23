import { Cascade, Entity, ManyToOne, PrimaryKey, PrimaryKeyType, Property } from '@mikro-orm/core'
import Leaderboard from './leaderboard'

@Entity()
export default class SteamworksLeaderboardMapping {
  [PrimaryKeyType]?: [number, number]

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
