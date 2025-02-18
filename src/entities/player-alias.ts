import { Collection, Entity, ManyToMany, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Player from './player'
import Redis from 'ioredis'
import { v4 } from 'uuid'
import GameChannel from './game-channel'

export enum PlayerAliasService {
  STEAM = 'steam',
  EPIC = 'epic',
  USERNAME = 'username',
  EMAIL = 'email',
  CUSTOM = 'custom',
  TALO = 'talo'
}

@Entity()
export default class PlayerAlias {
  @PrimaryKey()
  id: number

  @Property()
  service: string

  @Property({ length: 1024 })
  identifier: string

  @ManyToOne(() => Player, { eager: true })
  player: Player

  @Property()
  lastSeenAt: Date = new Date()

  @ManyToMany(() => GameChannel, (channel) => channel.members)
  channels = new Collection<GameChannel>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  async createSocketToken(redis: Redis): Promise<string> {
    const token = v4()
    await redis.set(`socketTokens.${this.id}`, token, 'EX', 3600)
    return token
  }

  toJSON() {
    const player = { ...this.player.toJSON(), aliases: undefined }

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
