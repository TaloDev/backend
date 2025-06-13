import { ConnectionOptions, Job, Processor, Queue, RedisOptions, Worker } from 'bullmq'
import redisConfig from '../../config/redis.config'
import handleJobFailure from './handleJobFailure'
import { BullMQOtel } from 'bullmq-otel'

export type WorkerEvents<T> = {
  failed?: (job: Job<T>, err: Error) => void | Promise<void>
  completed?: (job: Job<T>) => void | Promise<void>
}

function createQueue<T>(name: string, processor: Processor<T, unknown, string>, events: WorkerEvents<T> = {}): Queue<T> {
  const connection: ConnectionOptions = redisConfig as RedisOptions
  const queue = new Queue<T>(name, { connection, telemetry: new BullMQOtel('talo.queue') })
  const worker = new Worker<T>(queue.name, processor, { connection, telemetry: new BullMQOtel('talo.worker') })

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
