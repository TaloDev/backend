import { Entity, Embedded, ManyToOne, PrimaryKey, Property, Cascade } from '@mikro-orm/core'
import sanitiseProps from '../lib/props/sanitiseProps'
import Game from './game'
import PlayerAlias from './player-alias'
import Prop from './prop'

const eventMetaProps = ['META_OS', 'META_GAME_VERSION', 'META_WINDOW_MODE', 'META_SCREEN_WIDTH', 'META_SCREEN_HEIGHT']

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

  setProps(props: Prop[]) {
    this.props = sanitiseProps(props, true, (prop) => {
      return !prop.key.startsWith('META_') || eventMetaProps.includes(prop.key)
    })

    this.props.forEach((prop) => {
      if (eventMetaProps.includes(prop.key)) {
        this.playerAlias.player.addProp(prop.key, prop.value)
      }
    })
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
