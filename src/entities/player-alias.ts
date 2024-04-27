import { Cascade, Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Player from './player'

export enum PlayerAliasService {
  STEAM = 'steam',
  EPIC = 'epic',
  USERNAME = 'username',
  EMAIL = 'email',
  CUSTOM = 'custom'
}

@Entity()
export default class PlayerAlias {
  @PrimaryKey()
  id: number

  @Enum(() => PlayerAliasService)
  service: PlayerAliasService

  @Property()
  identifier: string

  @ManyToOne(() => Player, { cascade: [Cascade.REMOVE], eager: true })
  player: Player

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
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
