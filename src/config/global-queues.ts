import { Queue } from 'bullmq'
import createEmailQueue from '../lib/queues/createEmailQueue'
import { createClearResponseCacheQueue } from '../lib/perf/responseCacheQueue'
import { EmailConfig } from '../emails/mail'
import { createDeleteClickHousePlayerDataQueue, DeleteClickHousePlayerDataConfig } from '../lib/queues/createDeleteClickHousePlayerDataQueue'

const queueNames = [
  'email',
  'clear-response-cache',
  'delete-clickhouse-player-data'
] as const

type QueueName = typeof queueNames[number]
type QueueTypeMapping = {
  'email': Queue<EmailConfig>
  'clear-response-cache': Queue<string>
  'delete-clickhouse-player-data': Queue<DeleteClickHousePlayerDataConfig>
}

const queueMap = new Map<QueueName, Queue>()

export function setupGlobalQueues() {
  queueMap.set('email', createEmailQueue())
  queueMap.set('clear-response-cache', createClearResponseCacheQueue())
  queueMap.set('delete-clickhouse-player-data', createDeleteClickHousePlayerDataQueue())
}

export function getGlobalQueue<T extends QueueName>(queueName: T): QueueTypeMapping[T] {
  const queue = queueMap.get(queueName)
  /* v8 ignore next 3 */
  if (!queue) {
    throw new Error(`Queue not found: ${queueName}`)
  }
  return queue as QueueTypeMapping[T]
}
