import { Entity, JsonType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import Game from './game'
import PlayerAlias from './player-alias'

@Entity()
export default class Event {
  @PrimaryKey()
  id: number

  @Property()
  name: string

  @Property({ type: JsonType, nullable: true })
  props?: { [key: string]: any }

  @ManyToOne(() => Game)
  game: Game

  @ManyToOne(() => PlayerAlias)
  playerAlias: PlayerAlias

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(name: string, game: Game) {
    this.name = name
    this.game = game
  }
}
