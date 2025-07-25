import { Collection, Entity, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/mysql'
import GameFeedbackCategory from './game-feedback-category'
import { Required } from 'koa-clay'
import PlayerAlias from './player-alias'
import GameFeedbackProp from './game-feedback-prop'

@Entity()
export default class GameFeedback {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => GameFeedbackCategory, { nullable: false, deleteRule: 'cascade', eager: true })
  category: GameFeedbackCategory

  @ManyToOne(() => PlayerAlias, { nullable: false, deleteRule: 'cascade' })
  playerAlias: PlayerAlias

  @Required()
  @Property({ type: 'text' })
  comment!: string

  @Property()
  anonymised!: boolean

  @Required({
    methods: [],
    validation: async (val: unknown) => [
      {
        check: Array.isArray(val),
        error: 'Props must be an array'
      }
    ]
  })
  @OneToMany(() => GameFeedbackProp, (prop) => prop.gameFeedback, { eager: true, orphanRemoval: true })
  props: Collection<GameFeedbackProp> = new Collection<GameFeedbackProp>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(category: GameFeedbackCategory, playerAlias: PlayerAlias) {
    this.category = category
    this.playerAlias = playerAlias
  }

  setProps(props: { key: string, value: string }[]) {
    this.props.set(props.map(({ key, value }) => new GameFeedbackProp(this, key, value)))
  }

  toJSON() {
    return {
      id: this.id,
      category: this.category,
      comment: this.comment,
      anonymised: this.anonymised,
      playerAlias: this.anonymised ? null : this.playerAlias,
      devBuild: this.playerAlias.player.devBuild,
      props: this.props.getItems().map(({ key, value }) => ({ key, value })),
      createdAt: this.createdAt
    }
  }
}
