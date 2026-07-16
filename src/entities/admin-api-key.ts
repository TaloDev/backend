import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import Game from './game.js'
import User from './user.js'

export enum AdminAPIKeyScope {
  READ_STATS = 'read:stats',
  WRITE_STATS = 'write:stats',
  FULL_ACCESS = '*',
}

@Entity()
export default class AdminAPIKey {
  @PrimaryKey()
  id!: number

  @Enum({ items: () => AdminAPIKeyScope, array: true })
  scopes: AdminAPIKeyScope[] = []

  @Property({ unique: true })
  keyHash!: string

  @Property({ length: 8 })
  keyEnding: string

  @ManyToOne(() => Game)
  game: Game

  @ManyToOne(() => User)
  createdByUser: User

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt?: Date = new Date()

  @Property({ nullable: true })
  revokedAt?: Date

  @Property({ nullable: true })
  lastUsedAt?: Date

  constructor({
    game,
    createdByUser,
    keyHash,
    keyEnding,
  }: {
    game: Game
    createdByUser: User
    keyHash: string
    keyEnding: string
  }) {
    this.game = game
    this.createdByUser = createdByUser
    this.keyHash = keyHash
    this.keyEnding = keyEnding
  }

  toJSON() {
    return {
      id: this.id,
      scopes: this.scopes,
      gameId: this.game.id,
      createdBy: this.createdByUser.username,
      keyEnding: this.keyEnding,
      createdAt: this.createdAt,
      lastUsedAt: this.lastUsedAt,
    }
  }
}
