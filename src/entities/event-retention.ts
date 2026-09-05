import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/es'
import Game from './game.js'

@Entity()
@Unique({ properties: ['game', 'eventName'] })
export default class EventRetention {
  @PrimaryKey()
  id!: number

  @Property()
  eventName!: string

  @Property()
  retentionDays!: number

  @ManyToOne(() => Game)
  game: Game

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property()
  updatedAt: Date = new Date()

  constructor(game: Game, eventName: string, retentionDays: number) {
    this.game = game
    this.eventName = eventName
    this.retentionDays = retentionDays
  }

  toJSON() {
    return {
      id: this.id,
      eventName: this.eventName,
      retentionDays: this.retentionDays,
      updatedAt: this.updatedAt,
    }
  }
}
