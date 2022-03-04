import { Cascade, Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import Leaderboard from './leaderboard'
import PlayerAlias from './player-alias'

@Entity()
export default class LeaderboardEntry {
  @PrimaryKey()
  id: number

  @Property({ type: 'double' })
  score: number

  @ManyToOne(() => Leaderboard, { cascade: [Cascade.REMOVE] })
  leaderboard: Leaderboard

  @ManyToOne(() => PlayerAlias, { cascade: [Cascade.REMOVE], eager: true })
  playerAlias: PlayerAlias

  @Property({ default: false })
  hidden: boolean

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(leaderboard: Leaderboard) {
    this.leaderboard = leaderboard
  }

  toJSON() {
    return {
      id: this.id,
      score: this.score,
      leaderboardName: this.leaderboard.name,
      leaderboardInternalName: this.leaderboard.internalName,
      playerAlias: {
        id: this.playerAlias.id,
        service: this.playerAlias.service,
        identifier: this.playerAlias.identifier
      },
      hidden: this.hidden,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
