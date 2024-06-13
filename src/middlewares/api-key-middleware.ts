import { Context, Next } from 'koa'
import jwt from 'jsonwebtoken'
import { isAPIRoute } from './route-middleware'
import { EntityManager } from '@mikro-orm/mysql'
import APIKey from '../entities/api-key'

export default async function apiKeyMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isAPIRoute(ctx)) {
    const parts = (ctx.headers?.authorization ?? '').split('Bearer ')
    if (parts.length === 2) {
      const em: EntityManager = ctx.em
      const decodedToken = jwt.decode(parts[1])

      if (decodedToken) {
        const apiKey = await em.getRepository(APIKey).findOne(decodedToken.sub, {
          populate: ['game', 'game.apiSecret']
        })

        if (apiKey) {
          ctx.state.key = apiKey
          ctx.state.secret = apiKey.game.apiSecret.getPlainSecret()
          ctx.state.game = apiKey.game

          if (!apiKey.revokedAt) apiKey.lastUsedAt = new Date()
          await em.flush()
        }
      }
    }
  }

  await next()
}
