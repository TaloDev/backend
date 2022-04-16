import { Collection, Embedded, Entity, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core'
import Game from './game'
import { v4 } from 'uuid'
import PlayerAlias from './player-alias'
import Prop from './prop'

@Entity()
export default class Player {
  @PrimaryKey()
  id: string = v4()

  @OneToMany(() => PlayerAlias, (alias) => alias.player)
  aliases: Collection<PlayerAlias> = new Collection<PlayerAlias>(this)

  @Embedded(() => Prop, { array: true })
  props: Prop[] = []

  @ManyToOne(() => Game)
  game: Game

  @Property()
  lastSeenAt: Date = new Date()

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
      props: this.props,
      aliases: this.aliases,
      devBuild: this.props.some((prop) => prop.key === 'META_DEV_BUILD'),
      createdAt: this.createdAt,
      lastSeenAt: this.lastSeenAt
    }
  }
}
