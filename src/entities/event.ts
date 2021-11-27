import { Entity, Embedded, ManyToOne, PrimaryKey, Property, Cascade } from '@mikro-orm/core'
import Game from './game'
import PlayerAlias from './player-alias'
import Prop from './prop'

@Entity()
export default class Event {
  @PrimaryKey()
  id: number

  @Property()
  name: string

  @Embedded(() => Prop, { array: true })
  props: Prop[] = []

  @ManyToOne(() => Game)
  game: Game

  @ManyToOne(() => PlayerAlias, { cascade: [Cascade.REMOVE] })
  playerAlias: PlayerAlias

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(name: string, game: Game) {
    this.name = name
    this.game = game
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      props: this.props,
      playerAlias: this.playerAlias,
      gameId: this.game.id,
      createdAt: this.createdAt
    }
  }
}
