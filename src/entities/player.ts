import { Collection, Entity, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Game from './game'
import { v4 } from 'uuid'
import PlayerAlias from './player-alias'
import PlayerProp from './player-prop'
import PlayerGroup from './player-group'
import PlayerAuth from './player-auth'

@Entity()
export default class Player {
  @PrimaryKey()
  id: string = v4()

  @OneToMany(() => PlayerAlias, (alias) => alias.player)
  aliases: Collection<PlayerAlias> = new Collection<PlayerAlias>(this)

  @OneToMany(() => PlayerProp, (prop) => prop.player, { eager: true, orphanRemoval: true })
  props: Collection<PlayerProp> = new Collection<PlayerProp>(this)

  @ManyToMany(() => PlayerGroup, (group) => group.members, { eager: true })
  groups = new Collection<PlayerGroup>(this)

  @ManyToOne(() => Game)
  game: Game

  @OneToOne({ nullable: true, orphanRemoval: true })
  auth: PlayerAuth

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

  upsertProp(key: string, value: string) {
    const prop = this.props.getItems().find((prop) => prop.key === key)

    if (prop) {
      prop.value = value
    } else {
      this.addProp(key, value)
    }
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
      lastSeenAt: this.lastSeenAt,
      groups: this.groups.getItems().map((group) => ({ id: group.id, name: group.name })),
      auth: this.auth ?? undefined
    }
  }
}
