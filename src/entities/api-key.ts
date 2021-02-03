import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import Game from './game'
import { v4 } from 'uuid'

export enum APIKeyScope {
  READ_PLAYERS,
  WRITE_PLAYERS,
  READ_EVENTS,
  WRITE_EVENTS
}

@Entity()
export default class APIKey {
  @PrimaryKey()
  id: string = v4()

  @Enum()
  scopes: APIKeyScope[]

  @ManyToOne(() => Game)
  game: Game

  @Property()
  createdAt: Date = new Date()

  @Property({ nullable: true })
  revokedAt?: Date
}
