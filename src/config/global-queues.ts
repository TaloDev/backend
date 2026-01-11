import { Queue } from 'bullmq'
import { createEmailQueue } from '../lib/queues/createEmailQueue'
import { createClearResponseCacheQueue } from '../lib/perf/responseCacheQueue'
import { createDeleteClickHousePlayerDataQueue } from '../lib/queues/createDeleteClickHousePlayerDataQueue'

const queueFactories = {
  'email': createEmailQueue,
  'clear-response-cache': createClearResponseCacheQueue,
  'delete-clickhouse-player-data': createDeleteClickHousePlayerDataQueue
} as const

export const queueNames = Object.keys(queueFactories) as (keyof typeof queueFactories)[]

type QueueName = typeof queueNames[number]
type QueueTypeMapping = {
  [K in keyof typeof queueFactories]: ReturnType<typeof queueFactories[K]>
}

const queueMap = new Map<QueueName, Queue>()

export function setupGlobalQueues() {
  for (const [name, factory] of Object.entries(queueFactories)) {
    queueMap.set(name as QueueName, factory())
  }
}

export function getGlobalQueue<T extends QueueName>(queueName: T): QueueTypeMapping[T] {
  const queue = queueMap.get(queueName)
  /* v8 ignore next 3 */
  if (!queue) {
    throw new Error(`Queue not found: ${queueName}`)
  }
  return queue as QueueTypeMapping[T]
}
