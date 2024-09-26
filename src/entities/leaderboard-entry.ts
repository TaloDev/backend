import { Cascade, Embedded, Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Leaderboard from './leaderboard'
import PlayerAlias from './player-alias'
import Prop from './prop'

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

  @Embedded(() => Prop, { array: true })
  props: Prop[] = []

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
      playerAlias: this.playerAlias,
      hidden: this.hidden,
      props: this.props,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
