import { Collection } from '@mikro-orm/mysql'
import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import { spawnSync } from 'child_process'
import crypto from 'crypto'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import Game from '../../../../src/entities/game'
import GameCenterIntegrationEvent from '../../../../src/entities/game-center-integration-event'
import { IntegrationType } from '../../../../src/entities/integration'
import { PlayerAliasService } from '../../../../src/entities/player-alias'
import { clearCertCache } from '../../../../src/lib/integrations/clients/game-center-client'
import IntegrationFactory from '../../../fixtures/IntegrationFactory'
import PlayerAliasFactory from '../../../fixtures/PlayerAliasFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

const bundleId = 'com.example.game'
const publicKeyURL = 'https://static.gc.apple.com/public-key/gc-prod-6.cer'

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })

function makeCert() {
  const keyPath = join(tmpdir(), `gc-test-key-${process.pid}.pem`)
  try {
    writeFileSync(keyPath, privateKey.export({ format: 'pem', type: 'pkcs1' }))
    const result = spawnSync('openssl', [
      'req',
      '-x509',
      '-key',
      keyPath,
      '-days',
      '1',
      '-subj',
      '/CN=test',
      '-outform',
      'DER',
    ])
    if (result.status !== 0) {
      throw new Error(`openssl failed: ${result.stderr.toString()}`)
    }
    return result.stdout as Buffer
  } finally {
    unlinkSync(keyPath)
  }
}

function makeGameCenterIntegration(game: Game) {
  return new IntegrationFactory().construct(IntegrationType.GAME_CENTER, game, { bundleId }).one()
}

// simulate the client signing process to generate valid signatures for testing
function signPayload(playerID: string, bundleID: string, timestamp: number, salt: Buffer) {
  const playerIDBuf = Buffer.from(playerID, 'utf8')
  const bundleIDBuf = Buffer.from(bundleID, 'utf8')
  const timestampBuf = Buffer.alloc(8)
  timestampBuf.writeBigUInt64BE(BigInt(timestamp))

  const payload = Buffer.concat([playerIDBuf, bundleIDBuf, timestampBuf, salt])
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(payload)

  return sign.sign(privateKey, 'base64')
}

function makeIdentifier(
  overrides: Partial<{
    publicKeyURL: string
    signature: string
    salt: string
    timestamp: number
    playerID: string
    bundleID: string
  }> = {},
) {
  const playerID = overrides.playerID ?? 'playerid-123'
  const bundleID = overrides.bundleID ?? bundleId
  const timestamp = overrides.timestamp ?? Date.now()
  const salt = Buffer.from('random-salt')

  const signature = overrides.signature ?? signPayload(playerID, bundleID, timestamp, salt)

  return JSON.stringify({
    publicKeyURL,
    signature,
    salt: salt.toString('base64'),
    timestamp,
    playerID,
    bundleID,
    ...overrides,
  })
}

// generate a self-signed certificate to match Apple's real .cer format
const certDer = makeCert()

describe('Player API - Game Center identify', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  beforeEach(() => {
    clearCertCache()

    axiosMock.onGet(publicKeyURL).reply(200, certDer, {
      'cache-control': 'max-age=86400',
    })
  })

  afterEach(() => {
    axiosMock.reset()
  })

  it('should identify an existing game center player', async () => {
    const playerID = 'playerid-123'

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game])
      .state(async (p) => {
        const alias = await new PlayerAliasFactory(p)
          .state(() => ({
            service: PlayerAliasService.GAME_CENTER,
            identifier: playerID,
          }))
          .one()
        return {
          aliases: new Collection(p, [alias]),
        }
      })
      .one()

    const integration = await makeGameCenterIntegration(apiKey.game)
    await em.persist([integration, player]).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GAME_CENTER, identifier: makeIdentifier({ playerID }) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(playerID)
    expect(res.body.alias.player.id).toBe(player.id)
  })

  it('should identify a non-existent game center player by creating a new player with the write scope', async () => {
    const playerID = 'playerid-456'

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGameCenterIntegration(apiKey.game)
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GAME_CENTER, identifier: makeIdentifier({ playerID }) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(playerID)
    expect(res.body.alias.player.props).toStrictEqual([])
  })

  it('should use the raw identifier when no game center integration exists for the game', async () => {
    const identifier = makeIdentifier()

    const [, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GAME_CENTER, identifier })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(identifier)
  })

  it('should return a 400 for an invalid identifier format', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGameCenterIntegration(apiKey.game)
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GAME_CENTER, identifier: 'not-valid-json' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Failed to authenticate Game Center identity: invalid identifier format',
    })
  })

  it('should return a 400 when the bundle ID does not match', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGameCenterIntegration(apiKey.game)
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({
        service: PlayerAliasService.GAME_CENTER,
        identifier: makeIdentifier({ bundleID: 'com.attacker.game' }),
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Failed to authenticate Game Center identity: bundle mismatch',
    })
  })

  it('should return a 400 when the signature timestamp is stale', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGameCenterIntegration(apiKey.game)
    await em.persist(integration).flush()

    const staleTimestamp = Date.now() - 10 * 60 * 1000 // 10 minutes ago

    const res = await request(app)
      .get('/v1/players/identify')
      .query({
        service: PlayerAliasService.GAME_CENTER,
        identifier: makeIdentifier({ timestamp: staleTimestamp }),
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Failed to authenticate Game Center identity: signature expired',
    })
  })

  it('should return a 400 for an invalid public key URL domain', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGameCenterIntegration(apiKey.game)
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({
        service: PlayerAliasService.GAME_CENTER,
        identifier: makeIdentifier({ publicKeyURL: 'https://evil.com/fake-cert.cer' }),
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Failed to authenticate Game Center identity: invalid URL',
    })
  })

  it('should return a 400 when the public key URL is missing', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGameCenterIntegration(apiKey.game)
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({
        service: PlayerAliasService.GAME_CENTER,
        identifier: makeIdentifier({ publicKeyURL: undefined }),
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Failed to authenticate Game Center identity: invalid URL',
    })
  })

  it('should return a 503 when the certificate fetch fails', async () => {
    axiosMock.reset()
    axiosMock.onGet(publicKeyURL).reply(500)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGameCenterIntegration(apiKey.game)
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GAME_CENTER, identifier: makeIdentifier() })
      .auth(token, { type: 'bearer' })
      .expect(503)

    expect(res.body).toStrictEqual({
      message: 'Failed to authenticate Game Center identity: service unavailable',
    })
  })

  it('should persist a failed integration event when the certificate fetch fails', async () => {
    axiosMock.reset()
    axiosMock.onGet(publicKeyURL).reply(500)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGameCenterIntegration(apiKey.game)
    await em.persist(integration).flush()

    await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GAME_CENTER, identifier: makeIdentifier() })
      .auth(token, { type: 'bearer' })
      .expect(503)

    const event = await em.repo(GameCenterIntegrationEvent).findOne({ integration })
    expect(event).not.toBeNull()
    expect(event!.request).toMatchObject({ method: 'GET', url: publicKeyURL })
    expect(event!.response.status).toBe(500)
  })

  it('should return a 400 when the signature is invalid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGameCenterIntegration(apiKey.game)
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({
        service: PlayerAliasService.GAME_CENTER,
        identifier: makeIdentifier({ signature: Buffer.from('bad-signature').toString('base64') }),
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Failed to authenticate Game Center identity: invalid signature',
    })
  })

  it('should log an integration event for the certificate fetch', async () => {
    const certFetchMock = vi.fn(() => [200, certDer, { 'cache-control': 'max-age=86400' }])
    axiosMock.reset()
    axiosMock.onGet(publicKeyURL).reply(certFetchMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGameCenterIntegration(apiKey.game)
    await em.persist(integration).flush()

    // first request fetches the cert and logs an event
    await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GAME_CENTER, identifier: makeIdentifier() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(certFetchMock).toHaveBeenCalledOnce()
    expect(await em.repo(GameCenterIntegrationEvent).count({ integration })).toBe(1)

    // second request uses the cached cert and does not log an event
    await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GAME_CENTER, identifier: makeIdentifier() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(certFetchMock).toHaveBeenCalledOnce()
    expect(await em.repo(GameCenterIntegrationEvent).count({ integration })).toBe(1)
  })
})
