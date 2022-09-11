import { Collection, Entity, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core'
import Game from './game'
import { v4 } from 'uuid'
import PlayerAlias from './player-alias'
import PlayerProp from './player-prop'

@Entity()
export default class Player {
  @PrimaryKey()
  id: string = v4()

  @OneToMany(() => PlayerAlias, (alias) => alias.player)
  aliases: Collection<PlayerAlias> = new Collection<PlayerAlias>(this)

  @OneToMany(() => PlayerProp, (prop) => prop.player, { eager: true, orphanRemoval: true })
  props: Collection<PlayerProp> = new Collection<PlayerProp>(this)

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

  isDevBuild() {
    return this.props.getItems().some((prop) => prop.key === 'META_DEV_BUILD')
  }

  addProp(key: string, value: string) {
    this.props.add(new PlayerProp(this, key, value))
  }

  setProps(props: { key: string, value: string }[]) {
    this.props.set(props.map(({ key, value }) => new PlayerProp(this, key, value)))
  }

  toJSON() {
    return {
      id: this.id,
      props: this.props.getItems().map(({ key, value }) => ({ key, value })),
      aliases: this.aliases,
      devBuild: this.isDevBuild(),
      createdAt: this.createdAt,
      lastSeenAt: this.lastSeenAt
    }
  }
}
