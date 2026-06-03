import crypto from 'crypto'
import { APIKeyScope } from '../../../src/entities/api-key.js'
import { verifySignature } from '../../../src/lib/auth/verify-signature.js'
import PlayerFactory from '../../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../../utils/createAPIKeyAndToken.js'
import { createEncryptedKey, buildSignature } from '../../utils/signatureHelpers.js'

describe('verifySignature', () => {
  it('should return false for a missing signature', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const result = await verifySignature({
      signature: '',
      rawPayload: '{}',
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })

    expect(result).toBe(false)
  })

  it('should return false for a missing pipe separator', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const result = await verifySignature({
      signature: 'just-a-string-without-pipe',
      rawPayload: '{}',
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })

    expect(result).toBe(false)
  })

  it('should return false for a missing dot separator', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const result = await verifySignature({
      signature: '1|no-dot',
      rawPayload: '{}',
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })

    expect(result).toBe(false)
  })

  it('should return false for an unknown key version', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const body = JSON.stringify({ change: 1 })
    const sig = buildSignature(body, 'some-key', '2')

    const result = await verifySignature({
      signature: sig,
      rawPayload: body,
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })

    expect(result).toBe(false)
  })

  it('should return true for a valid signature', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([player, verificationKey]).flush()

    const body = JSON.stringify({ change: 1 })
    const sig = buildSignature(body, 'test-verification-key-1', '1')

    const result = await verifySignature({
      signature: sig,
      rawPayload: body,
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })

    expect(result).toBe(true)
  })

  it('should return false for a body hash mismatch', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([player, verificationKey]).flush()

    const sig = buildSignature('{"change":99}', 'test-verification-key-1', '1')

    const result = await verifySignature({
      signature: sig,
      rawPayload: JSON.stringify({ change: 1 }),
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })

    expect(result).toBe(false)
  })

  it('should return false for a replayed request id', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([player, verificationKey]).flush()

    const body = JSON.stringify({ change: 1 })
    const rid = crypto.randomUUID()
    const sig = buildSignature(body, 'test-verification-key-1', '1', { rid })

    const first = await verifySignature({
      signature: sig,
      rawPayload: body,
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })
    expect(first).toBe(true)

    const second = await verifySignature({
      signature: sig,
      rawPayload: body,
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })
    expect(second).toBe(false)
  })

  it('should return false for a timestamp more than 5 minutes from the server time', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([player, verificationKey]).flush()

    const body = JSON.stringify({ change: 1 })
    const sig = buildSignature(body, 'test-verification-key-1', '1', {
      timestamp: Date.now() - 301_000,
    })

    const result = await verifySignature({
      signature: sig,
      rawPayload: body,
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })

    expect(result).toBe(false)
  })

  it('should return false for invalid JSON in the header', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([player, verificationKey]).flush()

    const invalidJsonB64 = Buffer.from('not-json').toString('base64')
    const hmac = crypto
      .createHmac('sha256', 'test-verification-key-1')
      .update(invalidJsonB64)
      .digest()
    const sigB64 = Buffer.from(hmac).toString('base64')

    const result = await verifySignature({
      signature: `1|${invalidJsonB64}.${sigB64}`,
      rawPayload: JSON.stringify({ change: 1 }),
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })

    expect(result).toBe(false)
  })

  it('should return false when the HMAC signature is invalid', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([player, verificationKey]).flush()

    const body = JSON.stringify({ change: 1 })
    const sig = buildSignature(body, 'wrong-key', '1')

    const result = await verifySignature({
      signature: sig,
      rawPayload: body,
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })

    expect(result).toBe(false)
  })

  it('should return false when the timestamp is outside the sliding window', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([player, verificationKey]).flush()

    const body = JSON.stringify({ change: 1 })
    const now = Date.now()

    const firstSig = buildSignature(body, 'test-verification-key-1', '1', {
      timestamp: now,
      rid: crypto.randomUUID(),
    })
    const first = await verifySignature({
      signature: firstSig,
      rawPayload: body,
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })
    expect(first).toBe(true)

    const secondSig = buildSignature(body, 'test-verification-key-1', '1', {
      timestamp: now - 61_000,
      rid: crypto.randomUUID(),
    })
    const second = await verifySignature({
      signature: secondSig,
      rawPayload: body,
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })
    expect(second).toBe(false)
  })

  it('should cap timestamps to the current time', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([player, verificationKey]).flush()

    const body = JSON.stringify({ change: 1 })
    const now = Date.now()

    // request with future timestamp (4 minutes ahead, within 5 min window)
    const futureSig = buildSignature(body, 'test-verification-key-1', '1', {
      timestamp: now + 240_000,
      rid: crypto.randomUUID(),
    })
    const first = await verifySignature({
      signature: futureSig,
      rawPayload: body,
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })
    expect(first).toBe(true)

    // subsequent request at current time should NOT be rejected
    const normalSig = buildSignature(body, 'test-verification-key-1', '1', {
      timestamp: now,
      rid: crypto.randomUUID(),
    })
    const second = await verifySignature({
      signature: normalSig,
      rawPayload: body,
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })
    expect(second).toBe(true)
  })

  it('should accept out-of-order requests within 60 seconds of the latest', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([player, verificationKey]).flush()

    const body = JSON.stringify({ change: 1 })
    const now = Date.now()

    const sig1 = buildSignature(body, 'test-verification-key-1', '1', {
      timestamp: now + 50_000,
      rid: crypto.randomUUID(),
    })
    const first = await verifySignature({
      signature: sig1,
      rawPayload: body,
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })
    expect(first).toBe(true)

    const sig2 = buildSignature(body, 'test-verification-key-1', '1', {
      timestamp: now + 10_000,
      rid: crypto.randomUUID(),
    })
    const second = await verifySignature({
      signature: sig2,
      rawPayload: body,
      game: apiKey.game,
      aliasId: player.aliases[0].id,
      em,
      redis,
    })
    expect(second).toBe(true)
  })
})
