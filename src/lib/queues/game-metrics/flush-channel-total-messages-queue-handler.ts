import { EntityManager, raw } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import { getMikroORM } from '../../../config/mikro-orm.config'
import { createRedisConnection } from '../../../config/redis.config'
import GameChannel from '../../../entities/game-channel'
import createQueue from '../createQueue'

const REDIS_KEY = 'channel:total-messages'

let redis: ReturnType<typeof createRedisConnection>
let queueInitialised = false

function getRedis() {
  if (!redis) {
    redis = createRedisConnection()
  }
  return redis
}

export async function flush() {
  const items = await getRedis().hgetall(REDIS_KEY)
  if (!items || Object.keys(items).length === 0) {
    return
  }

  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager

  try {
    for (const [channelId, increment] of Object.entries(items)) {
      const inc = Number(increment)
      if (!inc) {
        continue
      }

      try {
        await em
          .qb(GameChannel, 'gc')
          .update({
            totalMessages: raw('total_messages + ?', [inc]),
            updatedAt: new Date(),
          })
          .where({ id: Number(channelId) })
          .execute()
      } catch (err) {
        captureException(err)
      }
    }

    await getRedis().hdel(REDIS_KEY, ...Object.keys(items))
  } finally {
    em.clear()
  }
}

function setupQueue() {
  const queue = createQueue('flush-channel-total-messages', async () => {
    /* v8 ignore next -- called manually in tests @preserve */
    await flush()
  })

  /* v8 ignore start -- @preserve */
  if (process.env.NODE_ENV !== 'test') {
    setImmediate(async () => {
      await queue.upsertJobScheduler(
        'flush-channel-total-messages-scheduler',
        { every: 30_000 },
        { name: 'flush-channel-total-messages-job' },
      )
    })
  }
  /* v8 ignore stop -- @preserve */
}

export async function incrementChannelTotalMessages(channelId: number) {
  if (!queueInitialised) {
    queueInitialised = true
    setupQueue()
  }

  try {
    await getRedis().hincrby(REDIS_KEY, String(channelId), 1)
  } catch (err) {
    captureException(err)
  }
}
