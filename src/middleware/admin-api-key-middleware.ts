import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { Redis } from 'ioredis'
import { Context, Next } from 'koa'
import AdminAPIKey from '../entities/admin-api-key.js'
import { getAdminAPIKeyFromToken } from '../lib/auth/getAdminAPIKeyFromToken.js'
import { isAdminAPIRoute } from '../lib/routing/route-info.js'

export const ADMIN_API_KEY_LAST_USED_HASH = 'admin-api-key:last-used'

async function recordLastUsedAt(
  redis: Redis,
  apiKey: Pick<AdminAPIKey, 'id' | 'revokedAt'>,
  lastUsedAt: Date,
) {
  await redis.hset(ADMIN_API_KEY_LAST_USED_HASH, String(apiKey.id), lastUsedAt.getTime())
}

export async function adminAPIKeyMiddleware(ctx: Context, next: Next) {
  if (isAdminAPIRoute(ctx)) {
    try {
      const apiKey = await getAdminAPIKeyFromToken(ctx.headers?.authorization ?? '')
      if (apiKey) {
        ctx.state.key = apiKey
        ctx.state.game = apiKey.game
        setTraceAttributes({ game_id: apiKey.game.id })
        /* v8 ignore start -- @preserve */
        const now = new Date()
        if (process.env.NODE_ENV !== 'test') {
          ctx.res.on('finish', async () => {
            await recordLastUsedAt(ctx.redis, apiKey, now)
          })
        } else {
          await recordLastUsedAt(ctx.redis, apiKey, now)
        }
        /* v8 ignore stop -- @preserve */
      } else {
        return ctx.throw(401)
      }
    } catch {
      return ctx.throw(401)
    }
  }
  await next()
}
