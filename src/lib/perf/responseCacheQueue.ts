import { getGlobalQueue } from '../../config/global-queues.js'
import createQueue from '../queues/createQueue.js'
import { clearResponseCache } from './responseCache.js'

export function createClearResponseCacheQueue() {
  return createQueue<string>('clearResponseCache', async (job) => {
    await clearResponseCache(job.data)
  })
}

export async function deferClearResponseCache(key: string) {
  const queue = getGlobalQueue('clear-response-cache')
  await queue.add('clear-key', key, {
    jobId: `clear-cache-${key}`,
    removeOnComplete: true,
    removeOnFail: true,
  })
}
