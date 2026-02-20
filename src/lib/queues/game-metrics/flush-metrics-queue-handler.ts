import { ClickHouseClient } from '@clickhouse/client'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import { Queue } from 'bullmq'
import Redis from 'ioredis'
import { getMikroORM } from '../../../config/mikro-orm.config'
import { createRedisConnection } from '../../../config/redis.config'
import Player from '../../../entities/player'
import createClickHouseClient from '../../clickhouse/createClient'
import createQueue from '../createQueue'

type FlushFunc<S> = (clickhouse: ClickHouseClient, values: S[]) => Promise<void>
type HandlerOptions<S> = {
  logsInTests?: boolean
  postFlush?: (values: S[]) => Promise<void>
}

let clickhouse: ReturnType<typeof createClickHouseClient>
let redis: Redis

export async function postFlushCheckMemberships(handlerName: string, playerIds: string[]) {
  const canLog = process.env.NODE_ENV !== 'test'
  const timeLabel = `${handlerName} checking groups for ${playerIds.length} players`

  /* v8 ignore next 3 */
  if (canLog) {
    console.time(timeLabel)
  }

  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager

  const players = await em.repo(Player).find({ id: { $in: playerIds } })
  for (const player of players) {
    const emFork = em.fork()
    try {
      await player.checkGroupMemberships(emFork)
    } finally {
      emFork.clear()
    }
  }

  /* v8 ignore next 3 */
  if (canLog) {
    console.timeEnd(timeLabel)
  }
}

type SerialisableData = Record<string, unknown> & { id: string }

export abstract class FlushMetricsQueueHandler<
  T extends { id: string },
  S extends SerialisableData = SerialisableData,
> {
  private queue: Queue
  private options: HandlerOptions<S>
  private redisKey: string
  private memoryFallback: Map<string, S> = new Map()

  constructor(
    private metricName: string,
    private flushFunc: FlushFunc<S>,
    options?: HandlerOptions<S>,
  ) {
    /* v8 ignore next */
    this.options = options ?? { logsInTests: true }
    this.redisKey = `metrics:buffer:${metricName}`

    if (!clickhouse) {
      clickhouse = createClickHouseClient()
    }

    if (!redis) {
      redis = createRedisConnection()
    }

    this.queue = createQueue(`flush-${metricName}`, async () => {
      /* v8 ignore next - called manually in tests */
      await this.handle()
    })

    /* v8 ignore next 3 */
    const flushInterval = process.env.GAME_METRICS_FLUSH_INTERVAL
      ? Number(process.env.GAME_METRICS_FLUSH_INTERVAL)
      : 30_000

    const jitter = Math.floor(Math.random() * 10_000) - 5_000 // -5000 to +5000ms
    const intervalWithJitter = Math.max(flushInterval + jitter, 25_000)

    setImmediate(async () => {
      const schedulerName = `flush-${metricName}-scheduler`
      await this.queue.upsertJobScheduler(
        schedulerName,
        { every: intervalWithJitter },
        { name: `flush-${metricName}-job` },
      )

      /* v8 ignore next 3 */
      if (process.env.NODE_ENV !== 'test') {
        console.info(
          `Upserted ${schedulerName} with interval: ${(intervalWithJitter / 1000).toFixed(2)}s`,
        )
      }
    })
  }

  async handle() {
    const values = await this.getAllBufferedItems()
    const bufferSize = values.length
    if (bufferSize === 0) {
      return
    }

    setTraceAttributes({ metricName: this.metricName, bufferSize })

    const canLog = process.env.NODE_ENV !== 'test' || (this.options.logsInTests ?? true)
    const timeLabel = `Flushed ${bufferSize} ${this.getFriendlyName()}`

    /* v8 ignore next 3 */
    if (canLog) {
      console.time(timeLabel)
    }

    try {
      await this.flushFunc(clickhouse, values)
      if (this.options.postFlush) {
        await this.options.postFlush(values)
      }

      await this.removeBufferedItems(values.map(({ id }) => id))

      /* v8 ignore start */
      if (canLog) {
        console.timeEnd(timeLabel)
      }
    } catch (err) {
      captureException(err)
    }
    /* v8 ignore stop */
  }

  getFriendlyName() {
    return this.metricName.replace('-', ' ')
  }

  async add(item: T) {
    void this.addBufferedItem(item)
  }

  private async addBufferedItem(item: T): Promise<void> {
    const serialised = this.serialiseItem(item)

    try {
      const pipeline = redis.pipeline()
      pipeline.hset(this.redisKey, serialised.id, JSON.stringify(serialised))
      pipeline.expire(this.redisKey, 300) // 5 mins, ~10 retries
      await pipeline.exec()
    } catch (err) {
      captureException(err)
      this.memoryFallback.set(serialised.id, serialised)
    }
  }

  private async getAllBufferedItems(): Promise<S[]> {
    const itemsMap = new Map<string, S>()

    try {
      const items = await redis.hgetall(this.redisKey)
      for (const [id, itemJson] of Object.entries(items)) {
        const parsedItem = JSON.parse(itemJson) as S
        itemsMap.set(id, parsedItem)
      }
    } catch (err) {
      captureException(err)
    }

    if (this.memoryFallback.size > 0) {
      for (const [id, item] of this.memoryFallback.entries()) {
        if (!itemsMap.has(id)) {
          itemsMap.set(id, item)
        }
      }
    }

    return Array.from(itemsMap.values())
  }

  protected abstract serialiseItem(item: T): S

  private async removeBufferedItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return

    try {
      await redis.hdel(this.redisKey, ...ids)
    } catch (err) {
      captureException(err)
    }

    for (const id of ids) {
      this.memoryFallback.delete(id)
    }
  }
}
