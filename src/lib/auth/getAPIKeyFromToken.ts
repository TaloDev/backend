import { RequestContext } from '@mikro-orm/mysql'
import jwt from 'jsonwebtoken'
import APIKey from '../../entities/api-key.js'
import GameSecret from '../../entities/game-secret.js'
import { getResultCacheOptions } from '../perf/getResultCacheOptions.js'

export function getTokenCacheKey(sub: number) {
  return `api-key-from-token-${sub}`
}

export default async function getAPIKeyFromToken(authHeader: string) {
  const parts = authHeader.split('Bearer ')
  if (parts.length === 2) {
    const em = RequestContext.getEntityManager()!
    const decodedToken = jwt.decode(parts[1])

    if (decodedToken) {
      const sub = Number(decodedToken.sub)
      const apiKey = await em.transactional(async (trx) => {
        const apiKey = await trx.repo(APIKey).findOneOrFail(sub, {
          ...getResultCacheOptions(getTokenCacheKey(sub), 600_000),
          exclude: ['game.props'],
          populate: ['game'],
        })

        const apiSecret = await trx.repo(GameSecret).findOneOrFail({ game: apiKey.game })
        apiKey.game.apiSecret = apiSecret

        return apiKey
      })

      return apiKey
    }
  }

  return null
}
