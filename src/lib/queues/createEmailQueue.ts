import { EmailConfig } from '../../emails/mail'
import sendEmail from '../messaging/sendEmail'
import createQueue, { WorkerEvents } from './createQueue'

export function createEmailQueue(events: WorkerEvents<EmailConfig> = {}, prefix = '') {
  const queue = createQueue<EmailConfig>(
    prefix + 'email',
    async (job) => {
      await sendEmail(job.data.mail)
    },
    events,
  )

  return queue
}
