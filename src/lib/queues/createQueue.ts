import Queue from 'bee-queue'
import redisConfig from '../../config/redis.config'
import handleJobFailure from './handleJobFailure'

const createQueue = (name: string): Queue => {
  const queue = new Queue(name, {
    redis: redisConfig,
    activateDelayedJobs: true
  })

  queue.on('failed', handleJobFailure)

  return queue
}

export default createQueue
