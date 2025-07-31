import { Context, Next } from 'koa'
import { isAPIRoute } from './route-middleware'
import getAPIKeyFromToken from '../lib/auth/getAPIKeyFromToken'
import { EntityManager } from '@mikro-orm/mysql'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import APIKey from '../entities/api-key'

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

      if (!apiKey.revokedAt) {
        await (<EntityManager>ctx.em).repo(APIKey).nativeUpdate({
          id: apiKey.id
        }, {
          lastUsedAt: new Date()
        })
      }
    }
  }

  await next()
}
