import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Redis from 'ioredis'
import { isArrayKey } from '../lib/props/sanitiseProps'
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

  static flatten(
    props: GameChannelStorageProp[],
  ): ReturnType<GameChannelStorageProp['toJSON']> | null {
    if (props.length === 0) {
      return null
    }

    if (props.length === 1 && !isArrayKey(props[0].key)) {
      return props[0].toJSON()
    }

    const sorted = [...props].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const representative = sorted[0].toJSON()
    representative.value = JSON.stringify(sorted.map((p) => p.value))
    return representative
  }

  static persistToRedis({
    redis,
    channelId,
    key,
    props,
  }: {
    redis: Redis
    channelId: number
    key: string
    props: GameChannelStorageProp[]
  }) {
    const flattened = GameChannelStorageProp.flatten(props)
    const redisKey = GameChannelStorageProp.getRedisKey(channelId, key)
    const expirationSeconds = GameChannelStorageProp.redisExpirationSeconds
    return redis.set(redisKey, JSON.stringify(flattened), 'EX', expirationSeconds)
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
