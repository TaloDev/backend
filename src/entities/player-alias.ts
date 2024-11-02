import { Cascade, Entity, Filter, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Player from './player'

export enum PlayerAliasService {
  STEAM = 'steam',
  EPIC = 'epic',
  USERNAME = 'username',
  EMAIL = 'email',
  CUSTOM = 'custom',
  TALO = 'talo'
}

@Entity()
@Filter({ name: 'notAnonymised', cond: { anonymised: false }, default: true })
export default class PlayerAlias {
  @PrimaryKey()
  id: number

  @Property()
  service: string

  @Property()
  identifier: string

  @ManyToOne(() => Player, { cascade: [Cascade.REMOVE], eager: true })
  player: Player

  @Property({ default: false })
  anonymised: boolean

  @Property()
  lastSeenAt: Date = new Date()

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  toJSON() {
    const player = { ...this.player.toJSON() }
    delete player.aliases

    return {
      id: this.id,
      service: this.service,
      identifier: this.identifier,
      player,
      lastSeenAt: this.lastSeenAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
