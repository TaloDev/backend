import crypto from 'crypto'
import request from 'supertest'
import { APIKeyScope } from '../../src/entities/api-key.js'
import { createEncryptedKey, buildSignature } from '../../tests/utils/signatureHelpers.js'
import GameStatFactory from '../fixtures/GameStatFactory.js'
import PlayerFactory from '../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken.js'

describe('Signature middleware', () => {
  it('should return 401 when x-talo-signature is missing', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true

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

  it('should skip verification when no alias is set', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CONFIG])
    apiKey.game.verifyRequests = true
    await em.flush()

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

  it('should accept a valid signature', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    apiKey.game.verifyRequests = true

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
})
