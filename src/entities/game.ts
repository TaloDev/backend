import { Collection, Entity, JsonType, ManyToMany, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core'
import Organisation from './organisation'
import Player from './player'
import User from './user'

@Entity()
export default class Game {
  @PrimaryKey()
  id: number

  @Property()
  name: string

  @ManyToOne(() => Organisation)
  organisation: Organisation

  @Property({ type: JsonType, nullable: true })
  props?: { [key: string]: any }

  @OneToMany(() => Player, (player) => player.game)
  players: Collection<Player> = new Collection<Player>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ nullable: true })
  deletedAt?: Date

  constructor(name: string, organisation: Organisation) {
    this.name = name
    this.organisation = organisation
  }
}
