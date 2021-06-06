import Queue from 'bee-queue'
import redisConfig from '../../config/redis.config'

const createQueue = (name: string): Queue => {
  const queue = new Queue(name, {
    redis: redisConfig,
    activateDelayedJobs: true
  })

  queue.on('error', (err) => {
    console.log(`A queue error happened: ${err.message}`)
  })

  queue.on('failed', (job, err) => {
    console.log(`Job ${job.id} failed with error ${err.message}`);
  })

  return queue
}

export default createQueue
