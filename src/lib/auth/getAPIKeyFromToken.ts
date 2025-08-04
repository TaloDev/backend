import { RequestContext } from '@mikro-orm/mysql'
import APIKey from '../../entities/api-key'
import jwt from 'jsonwebtoken'
import { getResultCacheOptions } from '../perf/getResultCacheOptions'

export function getTokenCacheKey(sub: number) {
  return `api-key-from-token-${sub}`
}

export default async function getAPIKeyFromToken(authHeader: string): Promise<APIKey | null> {
  const parts = authHeader.split('Bearer ')
  if (parts.length === 2) {
    const em = RequestContext.getEntityManager()!
    const decodedToken = jwt.decode(parts[1])

    if (decodedToken) {
      const sub = Number(decodedToken.sub)
      const apiKey = await em.getRepository(APIKey).findOne(Number(sub), {
        ...getResultCacheOptions(getTokenCacheKey(sub)),
        populate: ['game', 'game.apiSecret']
      })

      return apiKey
    }
  }

  return null
}
