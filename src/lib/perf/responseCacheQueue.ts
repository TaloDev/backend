import createQueue from '../queues/createQueue'
import { clearResponseCache } from './responseCache'
import { getGlobalQueue } from '../../config/global-queues'

export function createClearResponseCacheQueue() {
  return createQueue<string>('clearResponseCache', async (job) => {
    await clearResponseCache(job.data)
  })
}

export async function deferClearResponseCache(key: string) {
  const queue = getGlobalQueue('clear-response-cache')
  await queue.add('clear-key', key)
}
