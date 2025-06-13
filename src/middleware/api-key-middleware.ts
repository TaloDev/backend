import { Context, Next } from 'koa'
import { isAPIRoute } from './route-middleware'
import getAPIKeyFromToken from '../lib/auth/getAPIKeyFromToken'
import { EntityManager } from '@mikro-orm/mysql'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'

export default async function apiKeyMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isAPIRoute(ctx)) {
    const apiKey = await getAPIKeyFromToken(ctx.headers?.authorization ?? '')
    if (apiKey) {
      ctx.state.key = apiKey
      ctx.state.secret = apiKey.game.apiSecret.getPlainSecret()
      ctx.state.game = apiKey.game

      setTraceAttributes({
        game_id: apiKey.game.id
      })

      if (!apiKey.revokedAt) apiKey.lastUsedAt = new Date()
      await (<EntityManager>ctx.em).flush()
    }
  }

  await next()
}
