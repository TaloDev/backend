import { Job, Queue } from 'bullmq'
import Mail, { EmailConfig, EmailConfigMetadata } from '../../emails/mail'

export default async (emailQueue: Queue<EmailConfig>, mail: Mail, metadata?: EmailConfigMetadata): Promise<Job<EmailConfig>> => {
  const job = await emailQueue.add('new-email', {
    mail: mail.getConfig(),
    metadata
  })

  return job
}
