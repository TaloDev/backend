import { Queue } from 'bullmq'
import createQueue from '../createQueue'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import createClickHouseClient from '../../clickhouse/createClient'
import { captureException } from '@sentry/node'
import { ClickHouseClient } from '@clickhouse/client'
import { getMikroORM } from '../../../config/mikro-orm.config'
import { EntityManager } from '@mikro-orm/mysql'
import { createRedisConnection } from '../../../config/redis.config'
import Redis from 'ioredis'
import Player from '../../../entities/player'

type FlushFunc<S> = (clickhouse: ClickHouseClient, values: S[]) => Promise<void>
type HandlerOptions<S> = {
  logsInTests?: boolean
  postFlush?: (values: S[]) => Promise<void>
}

let clickhouse: ReturnType<typeof createClickHouseClient>
let redis: Redis

export async function postFlushCheckMemberships(playerIds: string[]) {
  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager
  try {
    const players = await em.repo(Player).find({ id: { $in: playerIds } })
    const promises = players.map((player) => player.checkGroupMemberships(em))
    await Promise.all(promises)
  } finally {
    em.clear()
  }
}

type SerialisableData = Record<string, unknown> & { id: string }

export abstract class FlushMetricsQueueHandler<T extends { id: string }, S extends SerialisableData = SerialisableData> {
  private queue: Queue
  private options: HandlerOptions<S>
  private redisKey: string

  constructor(private metricName: string, private flushFunc: FlushFunc<S>, options?: HandlerOptions<S>) {
    this.metricName = metricName
    this.flushFunc = flushFunc
    this.options = options ?? { logsInTests: true }
    this.redisKey = `metrics:buffer:${metricName}`

    if (!clickhouse) {
      clickhouse = createClickHouseClient()
    }

    if (!redis) {
      redis = createRedisConnection()
    }

    this.queue = createQueue(`flush-${metricName}`, async () => {
      /* v8 ignore next */
      await this.handle()
    })

    /* v8 ignore next 3 */
    const flushInterval = process.env.GAME_METRICS_FLUSH_INTERVAL
      ? Number(process.env.GAME_METRICS_FLUSH_INTERVAL)
      : 30_000

    const jitter = Math.floor(Math.random() * 10_000) - 5_000 // -5000 to +5000ms
    const intervalWithJitter = Math.max(flushInterval + jitter, 25_000)

    this.queue.upsertJobScheduler(
      `flush-${metricName}-scheduler`,
      { every: intervalWithJitter },
      { name: `flush-${metricName}-job` }
    )
  }

  async handle() {
    const values = await this.getAllBufferedItems()
    const bufferSize = values.length
    if (bufferSize === 0) {
      return
    }

    setTraceAttributes({ metricName: this.metricName, bufferSize })

    const canLog = process.env.NODE_ENV !== 'test' || (this.options.logsInTests ?? true)

    /* v8 ignore start */
    if (canLog) {
      console.info(`Flushing ${bufferSize} ${this.metricName.replace('-', ' ')}...`)
    }
    /* v8 ignore stop */

    try {
      await this.flushFunc(clickhouse, values)
      if (this.options.postFlush) {
        await this.options.postFlush(values)
      }

      await this.removeBufferedItems(values.map(({ id }) => id))

      /* v8 ignore start */
      if (canLog) {
        console.info(`Flushed ${bufferSize} ${this.getFriendlyName()}`)
      }
      /* v8 ignore stop */
    } catch (err) {
      console.error(err)
      captureException(err)
    }
  }

  getFriendlyName() {
    return this.metricName.replace('-', ' ')
  }

  async add(item: T) {
    await this.addBufferedItem(this.serialiseItem(item))
  }

  private async addBufferedItem(item: S): Promise<void> {
    try {
      await redis.hset(this.redisKey, item.id, JSON.stringify(item))
    } catch (err) {
      captureException(err)
    }
  }

  private async getAllBufferedItems(): Promise<S[]> {
    try {
      const items = await redis.hgetall(this.redisKey)
      return Object.values(items).map((itemJson) => JSON.parse(itemJson) as S)
    } catch (err) {
      captureException(err)
      return []
    }
  }

  protected abstract serialiseItem(item: T): S

  private async removeBufferedItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return

    try {
      await redis.hdel(this.redisKey, ...ids)
    } catch (err) {
      captureException(err)
    }
  }
}
