import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import assert from 'node:assert'
import AdminAPIKey from './admin-api-key.js'
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

  @ManyToOne(() => User, { nullable: true })
  createdByUser?: User

  @ManyToOne(() => AdminAPIKey, { nullable: true })
  createdByAdminAPIKey?: AdminAPIKey

  @Property()
  createdAt: Date = new Date()

  constructor(
    game: Game,
    actor: User | AdminAPIKey,
    key: string,
    value: string | null,
    applyAt: Date,
  ) {
    this.game = game

    if (actor instanceof User) {
      this.createdByUser = actor
    } else {
      this.createdByAdminAPIKey = actor
    }

    this.key = key
    this.value = value
    this.applyAt = applyAt
  }

  getActor(): User | AdminAPIKey {
    const actor = this.createdByUser ?? this.createdByAdminAPIKey
    assert(actor)

    return actor
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
