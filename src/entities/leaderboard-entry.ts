import { Cascade, Entity, ManyToOne, PrimaryKey, Property, Rel } from '@mikro-orm/mysql'
import Leaderboard from './leaderboard.js'
import PlayerAlias from './player-alias.js'

@Entity()
export default class LeaderboardEntry {
  @PrimaryKey()
  id: number

  @Property({ type: 'double' })
  score: number

  @ManyToOne(() => Leaderboard, { cascade: [Cascade.REMOVE] })
  leaderboard: Rel<Leaderboard>

  @ManyToOne(() => PlayerAlias, { cascade: [Cascade.REMOVE], eager: true })
  playerAlias: PlayerAlias

  @Property({ default: false })
  hidden: boolean

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(leaderboard: Rel<Leaderboard>) {
    this.leaderboard = leaderboard
  }

  toJSON() {
    return {
      id: this.id,
      score: this.score,
      leaderboardName: this.leaderboard.name,
      leaderboardInternalName: this.leaderboard.internalName,
      playerAlias: this.playerAlias,
      hidden: this.hidden,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
