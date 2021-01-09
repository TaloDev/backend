import { Collection, Entity, JsonType, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core'
import Event from './event'
import Game from './game'
import { v4 } from 'uuid'

export type PlayerAliases = {
  [key: string]: string
}

export enum PlayerPrivacyScope {
  ANONYMOUS,
  BASIC,
  FULL
}

@Entity()
export default class Player {
  @PrimaryKey()
  id: string = v4()

  @Property({ type: JsonType, nullable: true })
  aliases: PlayerAliases

  @Property()
  privacyScope: PlayerPrivacyScope

  @Property({ type: JsonType, nullable: true })
  props?: { [key: string]: any }

  @OneToMany(() => Event, (event) => event.player)
  events = new Collection<Event>(this)

  @ManyToOne(() => Game)
  game: Game

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ nullable: true })
  deletedAt?: Date
}
