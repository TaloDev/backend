import { EntityManager } from '@mikro-orm/mysql'
import crypto from 'crypto'
import { Redis } from 'ioredis'
import GameVerificationKey from '../../entities/game-verification-key.js'
import Game from '../../entities/game.js'
import { getResultCacheOptions } from '../perf/getResultCacheOptions.js'

const LATEST_TIMESTAMP_WINDOW = 60_000
const CURRENT_TIMESTAMP_WINDOW = 300_000
const REQUEST_TTL = 600

export async function verifySignature(opts: {
  signature: string
  rawPayload: string
  game: Game
  aliasId: number
  em: EntityManager
  redis: Redis
}): Promise<boolean> {
  const { signature, rawPayload, game, aliasId, em, redis } = opts

  if (signature.length === 0) {
    console.warn('verifySignature: missing signature')
    return false
  }

  const pipeIndex = signature.indexOf('|')
  if (pipeIndex === -1) {
    console.warn('verifySignature: missing pipe separator')
    return false
  }

  const keyVersion = signature.slice(0, pipeIndex)
  const token = signature.slice(pipeIndex + 1)

  const dotIndex = token.indexOf('.')
  if (dotIndex === -1) {
    console.warn('verifySignature: missing dot separator')
    return false
  }

  const headerB64 = token.slice(0, dotIndex)
  const signatureB64 = token.slice(dotIndex + 1)

  const headerStr = Buffer.from(headerB64, 'base64').toString('utf-8')

  let header: { rid: string; payload: string; timestamp: number }
  try {
    header = JSON.parse(headerStr)
  } catch {
    console.warn('verifySignature: invalid JSON in header')
    return false
  }

  const { rid, payload, timestamp } = header

  const verificationKey = await em
    .fork()
    .repo(GameVerificationKey)
    .findOne(
      {
        game,
        version: keyVersion,
      },
      {
        fields: ['value'],
        ...getResultCacheOptions(GameVerificationKey.getCacheKey(game, keyVersion)),
      },
    )

  if (!verificationKey) {
    console.warn('verifySignature: unknown verification key version', { keyVersion })
    return false
  }

  const expectedPayload = crypto.createHash('sha256').update(rawPayload).digest('hex')

  if (payload !== expectedPayload) {
    console.warn('verifySignature: body hash mismatch')
    return false
  }

  const plainKeyValue = verificationKey.decryptValue(game.apiSecret)
  const expectedHmac = crypto.createHmac('sha256', plainKeyValue).update(headerB64).digest()
  const providedSig = Buffer.from(signatureB64, 'base64')

  if (
    providedSig.length !== expectedHmac.length ||
    !crypto.timingSafeEqual(providedSig, expectedHmac)
  ) {
    console.warn('verifySignature: invalid signature HMAC')
    return false
  }

  const tsKey = `verification:ts:${aliasId}`
  const latestTimestampStr = await redis.get(tsKey)

  if (latestTimestampStr) {
    const latestTimestamp = Number(latestTimestampStr)
    if (latestTimestamp - timestamp > LATEST_TIMESTAMP_WINDOW) {
      console.warn('verifySignature: timestamp outside sliding window', {
        timestamp,
        latestTimestamp,
      })
      return false
    }
  }

  if (Math.abs(Date.now() - timestamp) > CURRENT_TIMESTAMP_WINDOW) {
    console.warn('verifySignature: timestamp outside server time window', { timestamp })
    return false
  }

  const ridKey = `verification:rid:${aliasId}:${rid}`
  const ridSet = await redis.set(ridKey, '1', 'EX', REQUEST_TTL, 'NX')
  if (ridSet !== 'OK') {
    console.warn('verifySignature: duplicate RID', { rid })
    return false
  }

  const newLatest = Math.max(Number(latestTimestampStr), timestamp)
  const cappedLatest = Math.min(newLatest, Date.now())
  await redis.set(tsKey, cappedLatest, 'EX', REQUEST_TTL)

  return true
}
