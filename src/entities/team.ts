import { Collection, Entity, OneToMany, PrimaryKey, Property } from '@mikro-orm/core'
import Game from './game'

@Entity()
export default class Team {
  constructor(name: string) {
    this.name = name
  }

  @PrimaryKey()
  id: number

  @Property()
  name: string

  @OneToMany(() => Game, (game) => game.team)
  games = new Collection<Game>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ nullable: true })
  deletedAt?: Date
}
