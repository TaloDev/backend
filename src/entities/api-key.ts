import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import Game from './game'
import { v4 } from 'uuid'
import User from './user'

export enum APIKeyScope {
  READ_PLAYERS = 'read:players',
  WRITE_PLAYERS = 'write:players',
  READ_EVENTS = 'read:events',
  WRITE_EVENTS = 'write:events'
}

@Entity()
export default class APIKey {
  @PrimaryKey()
  id: string = v4()

  @Enum({ items: () => APIKeyScope, array: true })
  scopes: APIKeyScope[] = []

  @ManyToOne(() => Game)
  game: Game

  @ManyToOne(() => User)
  createdByUser: User

  @Property()
  createdAt: Date = new Date()

  @Property({ nullable: true })
  revokedAt?: Date

  constructor(game: Game, createdByUser: User) {
    this.game = game
    this.createdByUser = createdByUser
  }
}
