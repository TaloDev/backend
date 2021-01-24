import { Collection, Entity, ManyToMany, PrimaryKey, Property } from '@mikro-orm/core'
import Game from './game'

@Entity()
export default class User {
  @PrimaryKey()
  id: number

  @Property()
  email: string

  @Property({ hidden: true })
  password: string

  @Property()
  lastSeenAt: Date = new Date()

  @Property()
  emailConfirmed: boolean

  @ManyToMany(() => Game, (game) => game.teamMembers)
  games: Collection<Game> = new Collection<Game>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ nullable: true })
  deletedAt?: Date
}
