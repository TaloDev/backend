import { Collection, Entity, JsonType, ManyToMany, OneToMany, PrimaryKey, Property } from '@mikro-orm/core'
import Player from './player'
import User from './user'

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
  players: Collection<Player> = new Collection<Player>(this)

  @ManyToMany(() => User, (user) => user.games, { owner: true })
  teamMembers: Collection<User> = new Collection<User>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ nullable: true })
  deletedAt?: Date
}
