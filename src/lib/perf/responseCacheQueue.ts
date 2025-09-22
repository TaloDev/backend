import { Queue } from 'bullmq'
import { Context } from 'koa'
import createQueue from '../queues/createQueue'
import { clearResponseCache } from './responseCache'

export function createClearResponseCacheQueue() {
  return createQueue<string>('clearResponseCache', async (job) => {
    await clearResponseCache(job.data)
  })
}

export async function deferClearResponseCache(ctx: Context, key: string) {
  const queue: Queue<string> = ctx.clearResponseCacheQueue
  await queue.add('clear-key', key)
}
