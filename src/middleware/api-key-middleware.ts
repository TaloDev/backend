import { Context, Next } from 'koa'
import { isAPIRoute } from './route-middleware'
import getAPIKeyFromToken from '../lib/auth/getAPIKeyFromToken'
import { EntityManager } from '@mikro-orm/mysql'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import APIKey from '../entities/api-key'
import Redis from 'ioredis'

export default async function apiKeyMiddleware(ctx: Context, next: Next): Promise<void> {
  const em: EntityManager = ctx.em
  const redis: Redis = ctx.redis

  if (!isAPIRoute(ctx)) {
    return await next()
  }

  const apiKey = await getAPIKeyFromToken(ctx.headers?.authorization ?? '')
  if (apiKey) {
    ctx.state.key = apiKey
    ctx.state.secret = apiKey.game.apiSecret.getPlainSecret()
    ctx.state.game = apiKey.game

    setTraceAttributes({
      game_id: apiKey.game.id
    })
  }

  await next()

  if (apiKey && !apiKey.revokedAt) {
    const key = `api-key:last-used:${apiKey.id}`
    const now = new Date()

    const result = await redis.set(key, now.getTime(), 'EX', 60, 'NX')
    if (result === 'OK') {
      await em.repo(APIKey).nativeUpdate({
        id: apiKey.id
      }, {
        lastUsedAt: now
      })
    }
  }
}
