import { EmailConfig } from '../../emails/mail.js'
import sendEmail from '../messaging/sendEmail.js'
import createQueue, { WorkerEvents } from './createQueue.js'

export function createEmailQueue(events: WorkerEvents<EmailConfig> = {}, prefix = '') {
  const queue = createQueue<EmailConfig>(
    prefix + 'email',
    async (job) => {
      await sendEmail(job.data.mail)
    },
    { events },
  )

  return queue
}
