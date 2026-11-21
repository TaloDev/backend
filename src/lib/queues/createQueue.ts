import { Job, KeepJobs, Processor, Queue, Worker, WorkerOptions } from 'bullmq'
import { BullMQOtel } from 'bullmq-otel'
import { createRedisConnection } from '../../config/redis.config.js'
import handleJobFailure from './handleJobFailure.js'

export type WorkerEvents<T> = {
  failed?: (job: Job<T>, err: Error) => void | Promise<void>
  completed?: (job: Job<T>) => void | Promise<void>
}

let redis: ReturnType<typeof createRedisConnection>

// without these, bullmq keeps every completed/failed job in redis forever,
// which grows unbounded for frequently-repeating scheduled jobs
// failed jobs are also persisted to the database by handleJobFailure
export const defaultRemoveOnComplete: KeepJobs = { age: 24 * 60 * 60, count: 1000 }
export const defaultRemoveOnFail: KeepJobs = { age: 7 * 24 * 60 * 60, count: 1000 }

function createQueue<T>(
  name: string,
  processor: Processor<T, unknown, string> | string,
  {
    events = {},
    workerOptions = {},
  }: {
    events?: WorkerEvents<T>
    workerOptions?: Partial<Omit<WorkerOptions, 'connection' | 'telemetry'>>
  } = {},
): Queue<T> {
  if (!redis) {
    redis = createRedisConnection({
      maxRetriesPerRequest: null,
    })
  }

  const queue = new Queue<T>(name, { connection: redis, telemetry: new BullMQOtel('talo.queue') })
  const worker = new Worker<T>(queue.name, processor, {
    removeOnComplete: defaultRemoveOnComplete,
    removeOnFail: defaultRemoveOnFail,
    ...workerOptions,
    connection: redis,
    telemetry: new BullMQOtel('talo.worker'),
  })

  worker.on('failed', async (job, err) => {
    if (job) {
      await events.failed?.(job, err)
      await handleJobFailure<T>(job, err)
    }
  })

  worker.on('completed', async (job: Job<T>) => {
    await events.completed?.(job)
  })

  return queue
}

export default createQueue
