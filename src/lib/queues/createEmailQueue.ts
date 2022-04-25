import createQueue from './createQueue'
import Queue from 'bee-queue'
import sendEmail, { EmailConfig } from '../messaging/sendEmail'

const createEmailQueue = () => {
  const queue = createQueue('email')
  queue.process(async (job: Queue.Job<EmailConfig>) => {
    await sendEmail(job.data.mail)
  })

  return queue
}

export default createEmailQueue
