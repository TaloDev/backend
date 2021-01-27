import { Collection, Entity, JsonType, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core'
import Event from './event'
import Game from './game'
import { v4 } from 'uuid'

export type PlayerAliases = {
  [key: string]: string
}

@Entity()
export default class Player {
  @PrimaryKey()
  id: string = v4()

  @Property({ type: JsonType, nullable: true })
  aliases: PlayerAliases

  @Property({ type: JsonType, nullable: true })
  props?: { [key: string]: any }

  @OneToMany(() => Event, (event) => event.player)
  events = new Collection<Event>(this)

  @ManyToOne(() => Game)
  game: Game

  // TODO: how do we know when they go offline?
  // @Property()
  // online: boolean

  @Property()
  lastSeenAt: Date = new Date()

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ nullable: true })
  deletedAt?: Date
}
