import { Next } from 'koa'
import { verifySignature } from '../lib/auth/verify-signature.js'
import { APIRouteContext } from '../lib/routing/context.js'

export async function signatureMiddleware(ctx: APIRouteContext, next: Next) {
  if (!ctx.state.game?.verifyRequests) {
    return next()
  }

  if (!ctx.state.currentAliasId) {
    return next()
  }

  if (ctx.method === 'GET') {
    return next()
  }

  const signature = ctx.headers['x-talo-signature']
  if (typeof signature !== 'string') {
    console.warn('signatureMiddleware: missing signature', {
      aliasId: ctx.state.currentAliasId,
    })
    return ctx.throw(401)
  }

  const valid = await verifySignature({
    signature,
    rawPayload: ctx.request.rawBody,
    game: ctx.state.game,
    aliasId: ctx.state.currentAliasId,
    em: ctx.em,
    redis: ctx.redis,
  })

  if (!valid) {
    return ctx.throw(401)
  }

  await next()
}
