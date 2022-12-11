import createQueue, { WorkerEvents } from './createQueue'
import sendEmail, { EmailConfig } from '../messaging/sendEmail'

const createEmailQueue = (events: WorkerEvents<EmailConfig> = {}) => {
  const queue = createQueue<EmailConfig>('email', async (job) => {
    await sendEmail(job.data.mail)
  }, events)

  return queue
}

export default createEmailQueue
