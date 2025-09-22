import { Context, Next } from 'koa'
import { isAPIRoute } from './route-middleware'
import getAPIKeyFromToken from '../lib/auth/getAPIKeyFromToken'
import { EntityManager } from '@mikro-orm/mysql'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import APIKey from '../entities/api-key'
import Redis from 'ioredis'

async function updateLastUsedAt(ctx: Context, apiKey: Pick<APIKey, 'id' | 'revokedAt'>, lastUsedAt: Date) {
  const em: EntityManager = ctx.em
  const redis: Redis = ctx.redis

  if (!apiKey.revokedAt) {
    const key = `api-key:last-used:${apiKey.id}`
    const result = await redis.set(key, lastUsedAt.getTime(), 'EX', 60, 'NX')
    if (result === 'OK') {
      await em.repo(APIKey).nativeUpdate({
        id: apiKey.id
      }, {
        lastUsedAt
      })
    }
  }
}

export default async function apiKeyMiddleware(ctx: Context, next: Next): Promise<void> {
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

    const now = new Date()
    /* v8 ignore start */
    if (process.env.NODE_ENV !== 'test') {
      ctx.res.on('finish', async () => {
        await updateLastUsedAt(ctx, apiKey, now)
      })
    } else {
      // in tests the connection would already be closed after the response is sent
      await updateLastUsedAt(ctx, apiKey, now)
    }
    /* v8 ignore stop */
  }

  await next()
}
