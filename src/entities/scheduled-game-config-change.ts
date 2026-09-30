import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import Game from './game.js'
import { MAX_KEY_LENGTH } from './prop.js'
import User from './user.js'

@Entity()
export default class ScheduledGameConfigChange {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Game, { deleteRule: 'cascade' })
  game: Game

  @Property({ length: MAX_KEY_LENGTH })
  key: string

  // null deletes the key when applied
  @Property({ type: 'text', nullable: true })
  value: string | null = null

  @Property()
  @Index()
  applyAt!: Date

  @ManyToOne(() => User)
  createdByUser: User

  @Property()
  createdAt: Date = new Date()

  constructor(game: Game, createdByUser: User, key: string, value: string | null, applyAt: Date) {
    this.game = game
    this.createdByUser = createdByUser
    this.key = key
    this.value = value
    this.applyAt = applyAt
  }

  toJSON() {
    return {
      id: this.id,
      key: this.key,
      value: this.value,
      applyAt: this.applyAt,
      createdAt: this.createdAt,
    }
  }
}
