import { Collection, Entity, JsonType, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core'
import Game from './game'
import { v4 } from 'uuid'
import PlayerAlias from './player-alias'
import Props from '../lib/types/props'

@Entity()
export default class Player {
  @PrimaryKey()
  id: string = v4()

  @OneToMany(() => PlayerAlias, (alias) => alias.player)
  aliases: Collection<PlayerAlias> = new Collection<PlayerAlias>(this)

  @Property({ type: JsonType })
  props: Props = {}

  @ManyToOne(() => Game)
  game: Game

  // TODO: how do we know when they go offline?
  // @Property()
  // online: boolean

  @Property()
  lastSeenAt: Date = new Date()

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(game: Game) {
    this.game = game
  }
}
