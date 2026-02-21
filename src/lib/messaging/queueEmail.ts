import { Queue } from 'bullmq'
import { createHash } from 'crypto'
import { createRedisConnection } from '../../config/redis.config'
import Mail, { EmailConfig, EmailConfigMetadata } from '../../emails/mail'
import checkRateLimitExceeded from '../errors/checkRateLimitExceeded'

let redis: ReturnType<typeof createRedisConnection>

export default async function queueEmail(
  emailQueue: Queue<EmailConfig>,
  mail: Mail,
  metadata?: EmailConfigMetadata,
): Promise<void> {
  const hashData = {
    to: mail.to,
    type: mail.constructor.name,
  }

  const hash = createHash('sha256').update(JSON.stringify(hashData)).digest('hex')

  if (!redis) {
    redis = createRedisConnection()
  }

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
