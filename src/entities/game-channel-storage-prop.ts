import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Redis from 'ioredis'
import GameChannel from './game-channel'
import PlayerAlias from './player-alias'
import { MAX_KEY_LENGTH, MAX_VALUE_LENGTH } from './prop'

@Entity()
@Index({ properties: ['gameChannel', 'key'] })
export default class GameChannelStorageProp {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => GameChannel, { deleteRule: 'cascade' })
  gameChannel: GameChannel

  @ManyToOne(() => PlayerAlias, { deleteRule: 'cascade', eager: true })
  createdBy!: PlayerAlias

  @ManyToOne(() => PlayerAlias, { deleteRule: 'cascade', eager: true })
  lastUpdatedBy!: PlayerAlias

  @Property({ length: MAX_KEY_LENGTH })
  key: string

  @Property({ length: MAX_VALUE_LENGTH })
  value: string

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  static getRedisKey(channelId: number, propKey: string): string {
    return `channel:${channelId}:storage:${propKey}`
  }

  static redisExpirationSeconds = 60 * 60 // 1 hour

  constructor(gameChannel: GameChannel, key: string, value: string) {
    this.gameChannel = gameChannel
    this.key = key
    this.value = value
  }

  persistToRedis(redis: Redis) {
    const redisKey = GameChannelStorageProp.getRedisKey(this.gameChannel.id, this.key)
    const expirationSeconds = GameChannelStorageProp.redisExpirationSeconds
    return redis.set(redisKey, JSON.stringify(this), 'EX', expirationSeconds)
  }

  toJSON() {
    return {
      key: this.key,
      value: this.value,
      createdBy: this.createdBy,
      lastUpdatedBy: this.lastUpdatedBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    }
  }
}
