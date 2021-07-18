import createQueue from './createQueue'
import Queue from 'bee-queue'
import sendEmail from '../messaging/sendEmail'

const createEmailQueue = () => {
  const queue = createQueue('email')
  queue.process(async (job: Queue.Job<any>) => {
    await sendEmail(job.data)
  })

  return queue
}

export default createEmailQueue
