import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Game from './game'

@Entity()
@Index({ properties: ['game', 'internalName'] })
export default class GameFeedbackCategory {
  @PrimaryKey()
  id!: number

  @Property()
  internalName!: string

  @Property()
  name!: string

  @Property()
  description!: string

  @Property()
  anonymised!: boolean

  @ManyToOne(() => Game)
  game: Game

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(game: Game) {
    this.game = game
  }

  toJSON() {
    return {
      id: this.id,
      internalName: this.internalName,
      name: this.name,
      description: this.description,
      anonymised: this.anonymised,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
