import BeeQueue from 'bee-queue'
import Mail from '../../emails/mail'
import { EmailConfig } from './sendEmail'

export default async (emailQueue: BeeQueue, mail: Mail): Promise<BeeQueue.Job<EmailConfig>> => {
  return await emailQueue
    .createJob<EmailConfig>({ mail: mail.getConfig() })
    .save()
}
