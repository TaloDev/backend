import { Next } from 'koa'
import { verifySignature } from '../lib/auth/verify-signature.js'
import { APIRouteContext } from '../lib/routing/context.js'

function isClaimableIdentifyRequest(ctx: APIRouteContext) {
  return ctx.method === 'POST' && ctx.path === '/v1/players/identify'
}

export async function signatureMiddleware(ctx: APIRouteContext, next: Next) {
  if (!ctx.state.game?.verifyRequests || ctx.method === 'GET') {
    return next()
  }

  const isIdentify = isClaimableIdentifyRequest(ctx)
  // if identifying, ignore any alias headers (if they exist)
  const aliasId = isIdentify ? undefined : ctx.state.currentAliasId

  // only verify claimable identify requests or ones with an alias
  if (!isIdentify && aliasId === undefined) {
    return next()
  }

  const signature = ctx.headers['x-talo-signature']
  if (typeof signature !== 'string') {
    console.warn('signatureMiddleware: missing signature', { aliasId })
    return ctx.throw(401)
  }

  const valid = await verifySignature({
    signature,
    rawPayload: ctx.request.rawBody,
    game: ctx.state.game,
    aliasId,
    em: ctx.em,
    redis: ctx.redis,
  })

  if (!valid) {
    return ctx.throw(401)
  }

  await next()
}
