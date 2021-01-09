import { Collection, Entity, JsonType, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core'
import Player from './player'
import Team from './team'

@Entity()
export default class Game {
  constructor(name: string) {
    this.name = name
  }

  @PrimaryKey()
  id: number

  @Property()
  name: string

  @Property({ type: JsonType, nullable: true })
  props?: { [key: string]: any }

  @OneToMany(() => Player, (player) => player.game)
  players = new Collection<Player>(this)

  @ManyToOne(() => Team)
  team: Team

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ nullable: true })
  deletedAt?: Date
}
