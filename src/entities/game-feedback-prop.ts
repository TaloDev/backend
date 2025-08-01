import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import { MAX_KEY_LENGTH, MAX_VALUE_LENGTH } from './prop'
import GameFeedback from './game-feedback'

@Entity()
export default class GameFeedbackProp {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => GameFeedback, { deleteRule: 'cascade' })
  gameFeedback: GameFeedback

  @Property({ length: MAX_KEY_LENGTH })
  key: string

  @Property({ length: MAX_VALUE_LENGTH })
  value: string

  @Property()
  createdAt: Date = new Date()

  constructor(gameFeedback: GameFeedback, key: string, value: string) {
    this.gameFeedback = gameFeedback
    this.key = key
    this.value = value
  }
}
