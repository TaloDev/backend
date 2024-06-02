import createQueue, { WorkerEvents } from './createQueue.js'
import sendEmail, { EmailConfig } from '../messaging/sendEmail.js'

const createEmailQueue = (events: WorkerEvents<EmailConfig> = {}, prefix = '') => {
  const queue = createQueue<EmailConfig>(prefix + 'email', async (job) => {
    await sendEmail(job.data.mail)
  }, events)

  return queue
}

export default createEmailQueue
