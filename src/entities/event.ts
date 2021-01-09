import { Entity, JsonType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import Player from './player'

@Entity()
export default class Event {
  constructor(name: string) {
    this.name = name
  }

  @PrimaryKey()
  id: number

  @Property()
  name: string

  @Property({ type: JsonType, nullable: true })
  props?: { [key: string]: any }

  @ManyToOne(() => Player)
  player: Player

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ nullable: true })
  deletedAt?: Date
}
