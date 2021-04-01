import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import Player from './player'

@Entity()
export default class PlayerAlias {
  @PrimaryKey()
  id: number

  @Property()
  service: string

  @Property()
  identifier: string

  @ManyToOne(() => Player)
  player: Player

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
