import { MikroORM } from '@mikro-orm/core'
import Queue from 'bee-queue'
import ormConfig from '../../config/mikro-orm.config'
import redisConfig from '../../config/redis.config'
import FailedJob from '../../entities/failed-job'

const createQueue = (name: string): Queue => {
  const queue = new Queue(name, {
    redis: redisConfig,
    activateDelayedJobs: true
  })

  queue.on('failed', async (job: Queue.Job<any>, err: Error) => {
    const orm = await MikroORM.init(ormConfig)

    const failedJob = new FailedJob()
    failedJob.payload = job.data
    failedJob.queue = job.queue.name
    failedJob.reason = err.message

    await orm.em.getRepository(FailedJob).persistAndFlush(failedJob)
    await orm.close()
  })

  return queue
}

export default createQueue
