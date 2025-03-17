import { Cascade, Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import GameFeedbackCategory from './game-feedback-category'
import { Required } from 'koa-clay'
import PlayerAlias from './player-alias'

@Entity()
export default class GameFeedback {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => GameFeedbackCategory, { nullable: false, cascade: [Cascade.REMOVE], eager: true })
  category: GameFeedbackCategory

  @ManyToOne(() => PlayerAlias, { nullable: false, cascade: [Cascade.REMOVE] })
  playerAlias: PlayerAlias

  @Required()
  @Property({ type: 'text' })
  comment!: string

  @Property()
  anonymised!: boolean

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(category: GameFeedbackCategory, playerAlias: PlayerAlias) {
    this.category = category
    this.playerAlias = playerAlias
  }

  toJSON() {
    return {
      id: this.id,
      category: this.category,
      comment: this.comment,
      anonymised: this.anonymised,
      playerAlias: this.anonymised ? null : this.playerAlias,
      devBuild: this.playerAlias.player.isDevBuild(),
      createdAt: this.createdAt
    }
  }
}
