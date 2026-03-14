import { Queue } from 'bullmq'
import { createHash } from 'crypto'
import { getGlobalRedis } from '../../config/redis.config'
import Mail, { EmailConfig, EmailConfigMetadata } from '../../emails/mail'
import checkRateLimitExceeded from '../errors/checkRateLimitExceeded'

export default async function queueEmail(
  emailQueue: Queue<EmailConfig>,
  mail: Mail,
  metadata?: EmailConfigMetadata,
) {
  const hashData = {
    to: mail.to,
    type: mail.constructor.name,
  }

  const redis = getGlobalRedis()
  const hash = createHash('sha256').update(JSON.stringify(hashData)).digest('hex')
  const rateLimitExceeded = await checkRateLimitExceeded(redis, `mail:${hash}`, 3)

  if (rateLimitExceeded) {
    console.warn(`Mail rate limit exceeded (to: ${hashData.to}, type: ${hashData.type})`)
    return
  }

  await emailQueue.add('new-email', {
    mail: mail.getConfig(),
    metadata,
  })
}
