import crypto from 'crypto'
import request from 'supertest'
import { APIKeyScope } from '../../src/entities/api-key.js'
import GameVerificationKey from '../../src/entities/game-verification-key.js'
import Game from '../../src/entities/game.js'
import GameStatFactory from '../fixtures/GameStatFactory.js'
import GameVerificationKeyFactory from '../fixtures/GameVerificationKeyFactory.js'
import PlayerFactory from '../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken.js'

async function createEncryptedKey(game: Game, value: string) {
  await em.populate(game, ['apiSecret'])

  const key = await new GameVerificationKeyFactory(game).value(value).one()
  key.value = GameVerificationKey.encryptValue(value, game.apiSecret)

  return key
}

function buildSignature(
  body: string,
  key: string,
  version: string,
  overrides?: { rid?: string; timestamp?: number },
) {
  const rid = overrides?.rid ?? crypto.randomUUID()
  const timestamp = overrides?.timestamp ?? Date.now()
  const payload = crypto.createHash('sha256').update(body).digest('hex')
  const header = { rid, payload, timestamp }
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64')
  const hmac = crypto.createHmac('sha256', key).update(headerB64).digest()
  const signatureB64 = Buffer.from(hmac).toString('base64')
  return `${version}|${headerB64}.${signatureB64}`
}

describe('Signature middleware', () => {
  it('should return 401 for a malformed signature (no dot separator)', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true
    await em.persist(apiKey.game).flush()

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist([stat, player]).flush()

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', '1|headerB64WithoutDot')
      .expect(401)
  })

  it('should return 401 for a malformed signature (no pipe)', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true
    await em.persist(apiKey.game).flush()

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist([stat, player]).flush()

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', 'just-a-string-without-pipe')
      .expect(401)
  })

  it('should return 401 when x-talo-signature is missing', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true
    await em.persist(apiKey.game).flush()

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist([stat, player]).flush()

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(401)
  })

  it('should return 401 for an unknown key version', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true
    await em.persist(apiKey.game).flush()

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist([stat, player]).flush()

    const body = JSON.stringify({ change: 1 })
    const sig = buildSignature(body, 'some-key', '2')

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', sig)
      .expect(401)
  })

  it('should accept a valid signature', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true
    await em.persist(apiKey.game).flush()

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([stat, player, verificationKey]).flush()

    const body = JSON.stringify({ change: 1 })
    const sig = buildSignature(body, 'test-verification-key-1', '1')

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', sig)
      .expect(200)
  })

  it('should return 401 when the body hash does not match', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true
    await em.persist(apiKey.game).flush()

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([stat, player, verificationKey]).flush()

    const sig = buildSignature('{"change":99}', 'test-verification-key-1', '1')

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', sig)
      .expect(401)
  })

  it('should return 401 for a replayed request id', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true
    await em.persist(apiKey.game).flush()

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([stat, player, verificationKey]).flush()

    const body = JSON.stringify({ change: 1 })
    const rid = crypto.randomUUID()
    const sig = buildSignature(body, 'test-verification-key-1', '1', { rid })

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', sig)
      .expect(200)

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', sig)
      .expect(401)
  })

  it('should return 401 for a timestamp more than 5 minutes from the server time', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true
    await em.persist(apiKey.game).flush()

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([stat, player, verificationKey]).flush()

    const body = JSON.stringify({ change: 1 })
    const sig = buildSignature(body, 'test-verification-key-1', '1', {
      timestamp: Date.now() - 301_000,
    })

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', sig)
      .expect(401)
  })

  it('should skip verification when no alias is set', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CONFIG])
    apiKey.game.verifyRequests = true
    await em.persist(apiKey.game).flush()

    await request(app).get('/v1/game-config').auth(token, { type: 'bearer' }).expect(200)
  })

  it('should skip verification when verifyRequests is false', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist([stat, player]).flush()

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)
  })

  it('should return 401 for invalid JSON in the header', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true
    await em.persist(apiKey.game).flush()

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([stat, player, verificationKey]).flush()

    const invalidJsonB64 = Buffer.from('not-json').toString('base64')
    const hmac = crypto
      .createHmac('sha256', 'test-verification-key-1')
      .update(invalidJsonB64)
      .digest()
    const sigB64 = Buffer.from(hmac).toString('base64')

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', `1|${invalidJsonB64}.${sigB64}`)
      .expect(401)
  })

  it('should return 401 when the HMAC signature is invalid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true
    await em.persist(apiKey.game).flush()

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([stat, player, verificationKey]).flush()

    const body = JSON.stringify({ change: 1 })
    const sig = buildSignature(body, 'wrong-key', '1')

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', sig)
      .expect(401)
  })

  it('should return 401 when the timestamp is outside the sliding window', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true
    await em.persist(apiKey.game).flush()

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000, minTimeBetweenUpdates: 0 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([stat, player, verificationKey]).flush()

    const body = JSON.stringify({ change: 1 })
    const now = Date.now()

    const firstSig = buildSignature(body, 'test-verification-key-1', '1', {
      timestamp: now,
      rid: crypto.randomUUID(),
    })
    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', firstSig)
      .expect(200)

    const secondSig = buildSignature(body, 'test-verification-key-1', '1', {
      timestamp: now - 61_000,
      rid: crypto.randomUUID(),
    })
    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', secondSig)
      .expect(401)
  })

  it('should cap the stored timestamp so future timestamps do not poison the sliding window', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true
    await em.persist(apiKey.game).flush()

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000, minTimeBetweenUpdates: 0 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([stat, player, verificationKey]).flush()

    const body = JSON.stringify({ change: 1 })
    const now = Date.now()

    // request with future timestamp (4 minutes ahead, within 5 min window)
    const futureSig = buildSignature(body, 'test-verification-key-1', '1', {
      timestamp: now + 240_000,
      rid: crypto.randomUUID(),
    })
    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', futureSig)
      .expect(200)

    // subsequent request at current time should NOT be rejected
    const normalSig = buildSignature(body, 'test-verification-key-1', '1', {
      timestamp: now,
      rid: crypto.randomUUID(),
    })
    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', normalSig)
      .expect(200)
  })

  it('should accept out-of-order requests within 60 seconds of the latest', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true
    await em.persist(apiKey.game).flush()

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000, minTimeBetweenUpdates: 0 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()

    const verificationKey = await createEncryptedKey(apiKey.game, 'test-verification-key-1')
    await em.persist([stat, player, verificationKey]).flush()

    const body = JSON.stringify({ change: 1 })
    const now = Date.now()

    const sig1 = buildSignature(body, 'test-verification-key-1', '1', {
      timestamp: now + 50_000,
      rid: crypto.randomUUID(),
    })
    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', sig1)
      .expect(200)

    const sig2 = buildSignature(body, 'test-verification-key-1', '1', {
      timestamp: now + 10_000,
      rid: crypto.randomUUID(),
    })
    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-signature', sig2)
      .expect(200)
  })
})
