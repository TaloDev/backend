import crypto from 'crypto'
import { Next } from 'koa'
import GameVerificationKey from '../entities/game-verification-key.js'
import { getResultCacheOptions } from '../lib/perf/getResultCacheOptions.js'
import { APIRouteContext } from '../lib/routing/context.js'

const LATEST_TIMESTAMP_WINDOW = 60_000
const CURRENT_TIMESTAMP_WINDOW = 300_000
const REQUEST_TTL = 600

export async function signatureMiddleware(ctx: APIRouteContext, next: Next) {
  if (!ctx.state.game.verifyRequests) {
    return next()
  }

  if (!ctx.state.currentAliasId) {
    return next()
  }

  const signatureHeader = ctx.headers['x-talo-signature']
  if (typeof signatureHeader !== 'string') {
    console.warn('signatureMiddleware: missing header', {
      aliasId: ctx.state.currentAliasId,
    })
    return ctx.throw(401)
  }

  const pipeIndex = signatureHeader.indexOf('|')
  if (pipeIndex === -1) {
    console.warn('signatureMiddleware: missing pipe separator')
    return ctx.throw(401)
  }

  const keyVersion = signatureHeader.slice(0, pipeIndex)
  const token = signatureHeader.slice(pipeIndex + 1)

  const dotIndex = token.indexOf('.')
  if (dotIndex === -1) {
    console.warn('signatureMiddleware: missing dot separator')
    return ctx.throw(401)
  }

  const headerB64 = token.slice(0, dotIndex)
  const signatureB64 = token.slice(dotIndex + 1)

  const headerStr = Buffer.from(headerB64, 'base64').toString('utf-8')

  let header: { rid: string; payload: string; timestamp: number }
  try {
    header = JSON.parse(headerStr)
  } catch {
    console.warn('signatureMiddleware: invalid JSON in header')
    return ctx.throw(401)
  }

  const { rid, payload, timestamp } = header

  const verificationKey = await ctx.em.repo(GameVerificationKey).findOne(
    {
      game: ctx.state.game,
      version: keyVersion,
    },
    getResultCacheOptions(GameVerificationKey.getCacheKey(ctx.state.game, keyVersion)),
  )

  if (!verificationKey) {
    console.warn('signatureMiddleware: unknown verification key version', { keyVersion })
    return ctx.throw(401)
  }

  const rawBody = ctx.request.rawBody
  const expectedPayload = crypto.createHash('sha256').update(rawBody).digest('hex')

  if (payload !== expectedPayload) {
    console.warn('signatureMiddleware: body hash mismatch')
    return ctx.throw(401)
  }

  const plainKeyValue = verificationKey.decryptValue(ctx.state.game.apiSecret)
  const expectedHmac = crypto.createHmac('sha256', plainKeyValue).update(headerB64).digest()
  const providedSig = Buffer.from(signatureB64, 'base64')

  if (
    providedSig.length !== expectedHmac.length ||
    !crypto.timingSafeEqual(providedSig, expectedHmac)
  ) {
    console.warn('signatureMiddleware: invalid signature HMAC')
    return ctx.throw(401)
  }

  const aliasId = ctx.state.currentAliasId
  const tsKey = `verification:ts:${aliasId}`
  const latestTimestampStr = await ctx.redis.get(tsKey)

  if (latestTimestampStr) {
    const latestTimestamp = Number(latestTimestampStr)
    if (latestTimestamp - timestamp > LATEST_TIMESTAMP_WINDOW) {
      console.warn('signatureMiddleware: timestamp outside sliding window', {
        timestamp,
        latestTimestamp,
      })
      return ctx.throw(401)
    }
  }

  if (Math.abs(Date.now() - timestamp) > CURRENT_TIMESTAMP_WINDOW) {
    console.warn('signatureMiddleware: timestamp outside server time window', { timestamp })
    return ctx.throw(401)
  }

  const ridKey = `verification:rid:${aliasId}:${rid}`
  const ridSet = await ctx.redis.set(ridKey, '1', 'EX', REQUEST_TTL, 'NX')
  if (ridSet !== 'OK') {
    console.warn('signatureMiddleware: duplicate RID', { rid })
    return ctx.throw(401)
  }

  const newLatest = Math.max(Number(latestTimestampStr), timestamp)
  const cappedLatest = Math.min(newLatest, Date.now())
  await ctx.redis.set(tsKey, cappedLatest, 'EX', REQUEST_TTL)

  await next()
}
