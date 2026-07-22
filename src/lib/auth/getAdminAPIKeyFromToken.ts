import { RequestContext } from '@mikro-orm/mysql'
import crypto from 'node:crypto'
import AdminAPIKey from '../../entities/admin-api-key.js'
import { getResultCacheOptions } from '../perf/getResultCacheOptions.js'

export function getAdminTokenCacheKey(keyHash: string) {
  return `admin-api-key-from-token-${keyHash}`
}

export async function getAdminAPIKeyFromToken(authHeader: string) {
  const parts = authHeader.split('Bearer ')
  if (parts.length === 2) {
    const keyHash = crypto.createHash('sha256').update(parts[1]).digest('hex')
    const em = RequestContext.getEntityManager()!

    return await em.repo(AdminAPIKey).findOne(
      { keyHash, revokedAt: null },
      {
        ...getResultCacheOptions(getAdminTokenCacheKey(keyHash), 600_000),
        exclude: ['game.props'],
        populate: ['game'],
      },
    )
  }
  return null
}
