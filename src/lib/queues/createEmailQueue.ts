import createQueue, { WorkerEvents } from './createQueue'
import sendEmail from '../messaging/sendEmail'
import { EmailConfig } from '../../emails/mail'

const createEmailQueue = (events: WorkerEvents<EmailConfig> = {}, prefix = '') => {
  const queue = createQueue<EmailConfig>(prefix + 'email', async (job) => {
    await sendEmail(job.data.mail)
  }, events)

  return queue
}

export default createEmailQueue
