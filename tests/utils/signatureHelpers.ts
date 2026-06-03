import crypto from 'crypto'
import GameVerificationKey from '../../src/entities/game-verification-key.js'
import Game from '../../src/entities/game.js'
import GameVerificationKeyFactory from '../fixtures/GameVerificationKeyFactory.js'

export async function createEncryptedKey(game: Game, value: string) {
  await em.populate(game, ['apiSecret'])
  const key = await new GameVerificationKeyFactory(game).value(value).one()
  key.value = GameVerificationKey.encryptValue(value, game.apiSecret)
  return key
}

export function buildSignature(
  body: string,
  key: string,
  version: string,
  overrides?: { rid?: string; timestamp?: number },
) {
  const rid = overrides?.rid ?? crypto.randomUUID()
  const timestamp = overrides?.timestamp ?? Date.now()

  const payload = crypto.createHash('sha256').update(body).digest('hex')
  const headerB64 = Buffer.from(JSON.stringify({ rid, payload, timestamp })).toString('base64')

  const hmac = crypto.createHmac('sha256', key).update(headerB64).digest()
  const signatureB64 = Buffer.from(hmac).toString('base64')

  return `${version}|${headerB64}.${signatureB64}`
}
