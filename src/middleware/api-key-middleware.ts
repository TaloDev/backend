import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { Redis } from 'ioredis'
import { Context, Next } from 'koa'
import APIKey from '../entities/api-key.js'
import getAPIKeyFromToken from '../lib/auth/getAPIKeyFromToken.js'
import { isAPIRoute } from '../lib/routing/route-info.js'

export const API_KEY_LAST_USED_HASH = 'api-key:last-used'

async function recordLastUsedAt(
  redis: Redis,
  apiKey: Pick<APIKey, 'id' | 'revokedAt'>,
  lastUsedAt: Date,
) {
  if (!apiKey.revokedAt) {
    await redis.hset(API_KEY_LAST_USED_HASH, String(apiKey.id), lastUsedAt.getTime())
  }
}

export async function apiKeyMiddleware(ctx: Context, next: Next) {
  if (isAPIRoute(ctx)) {
    try {
      const apiKey = await getAPIKeyFromToken(ctx.headers?.authorization ?? '')
      if (apiKey) {
        ctx.state.key = apiKey
        ctx.state.secret = apiKey.game.apiSecret.getPlainSecret()
        ctx.state.game = apiKey.game

        setTraceAttributes({ game_id: apiKey.game.id })

        /* v8 ignore start -- @preserve */
        const now = new Date()
        if (process.env.NODE_ENV !== 'test') {
          ctx.res.on('finish', async () => {
            await recordLastUsedAt(ctx.redis, apiKey, now)
          })
        } else {
          // in tests the connection would already be closed after the response is sent
          await recordLastUsedAt(ctx.redis, apiKey, now)
        }
        /* v8 ignore stop -- @preserve */
      }
    } catch {
      return ctx.throw(401)
    }
  }

  await next()
}
