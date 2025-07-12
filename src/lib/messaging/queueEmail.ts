import { Queue } from 'bullmq'
import Mail, { EmailConfig, EmailConfigMetadata } from '../../emails/mail'
import Redis from 'ioredis'
import redisConfig from '../../config/redis.config'
import checkRateLimitExceeded from '../errors/checkRateLimitExceeded'
import { createHash } from 'crypto'

export default async (emailQueue: Queue<EmailConfig>, mail: Mail, metadata?: EmailConfigMetadata): Promise<void> => {
  const hashData = {
    to: mail.to,
    type: mail.constructor.name
  }

  const hash = createHash('sha256')
    .update(JSON.stringify(hashData))
    .digest('hex')

  const redis = new Redis(redisConfig)
  const rateLimitExceeded = await checkRateLimitExceeded(redis, `mail:${hash}`, 3)
  await redis.quit()

  if (rateLimitExceeded) {
    console.warn(`Mail rate limit exceeded (to: ${hashData.to}, type: ${hashData.type})`)
    return
  }

  await emailQueue.add('new-email', {
    mail: mail.getConfig(),
    metadata
  })
}
