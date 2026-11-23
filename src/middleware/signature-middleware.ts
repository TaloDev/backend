import { Next } from 'koa'
import { SignatureNamespace, verifySignature } from '../lib/auth/verify-signature.js'
import { APIRouteContext } from '../lib/routing/context.js'

function isClaimableIdentifyRequest(ctx: APIRouteContext) {
  return ctx.method === 'POST' && ctx.path === '/v1/players/identify'
}

function resolveNamespace(ctx: APIRouteContext): SignatureNamespace | undefined {
  if (isClaimableIdentifyRequest(ctx)) {
    return SignatureNamespace.unidentified()
  }

  if (ctx.state.currentAliasId !== undefined) {
    return SignatureNamespace.alias(ctx.state.currentAliasId)
  }

  if (ctx.state.currentPlayerId) {
    return SignatureNamespace.player(ctx.state.currentPlayerId)
  }

  return undefined
}

export async function signatureMiddleware(ctx: APIRouteContext, next: Next) {
  if (!ctx.state.game?.verifyRequests || ctx.method === 'GET') {
    return next()
  }

  const namespace = resolveNamespace(ctx)

  // socket tickets and auth register carry no player or alias
  if (!namespace) {
    return next()
  }

  const signature = ctx.headers['x-talo-signature']
  if (typeof signature !== 'string') {
    console.warn('signatureMiddleware: missing signature', { namespace })
    return ctx.throw(401)
  }

  const valid = await verifySignature({
    signature,
    rawPayload: ctx.request.rawBody ?? '',
    game: ctx.state.game,
    namespace,
    em: ctx.em,
    redis: ctx.redis,
  })

  if (!valid) {
    return ctx.throw(401)
  }

  await next()
}
