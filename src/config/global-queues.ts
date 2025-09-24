import { Queue } from 'bullmq'
import createEmailQueue from '../lib/queues/createEmailQueue'
import { createClearResponseCacheQueue } from '../lib/perf/responseCacheQueue'
import { EmailConfig } from '../emails/mail'

const queueNames = ['email', 'clear-response-cache'] as const
type QueueName = typeof queueNames[number]

type QueueTypeMapping = {
  'email': Queue<EmailConfig>
  'clear-response-cache': Queue<string>
}

const queueMap = new Map<QueueName, Queue>()

export function setupGlobalQueues() {
  queueMap.set('email', createEmailQueue())
  queueMap.set('clear-response-cache', createClearResponseCacheQueue())
}

export function getGlobalQueue<T extends QueueName>(queueName: T): QueueTypeMapping[T] {
  const queue = queueMap.get(queueName)
  /* v8 ignore next 3 */
  if (!queue) {
    throw new Error(`Queue not found: ${queueName}`)
  }
  return queue as QueueTypeMapping[T]
}
