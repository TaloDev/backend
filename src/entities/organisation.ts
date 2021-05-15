import { Collection, Entity, OneToMany, PrimaryKey, Property } from '@mikro-orm/core'
import Game from './game'

// TODO billing plan

@Entity()
export default class Organisation {
  @PrimaryKey()
  id: number

  @Property()
  email: string

  @Property()
  name: string

  @OneToMany(() => Game, (game) => game.organisation, { eager: true })
  games: Collection<Game> = new Collection<Game>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      games: this.games
    }
  }
}
