import { EntityManager } from '@mikro-orm/mysql'
import crypto from 'crypto'
import Integration from '../../../entities/integration'
import PlayerAlias, { PlayerAliasService } from '../../../entities/player-alias'
import { GameCenterClient } from '../clients/game-center-client'

type GameCenterIdentity = {
  publicKeyUrl: string
  signature: string // base64
  salt: string // base64
  timestamp: number // UInt64 from client
  playerId: string // teamPlayerID (or gamePlayerID for Apple Arcade)
  bundleId: string
}

export type AuthenticateSignatureResult = {
  playerId: string
  initialPlayerProps?: { key: string; value: string }[]
}

const SIGNATURE_STALENESS_THRESHOLD_MS = 300_000 // 5 minutes

function verifyGameCenterIdentity(
  cert: Buffer,
  { signature, salt, timestamp, playerId, bundleId }: GameCenterIdentity,
) {
  const playerIdBuf = Buffer.from(playerId, 'utf8')
  const bundleIdBuf = Buffer.from(bundleId, 'utf8')

  const timestampBuf = Buffer.alloc(8)
  timestampBuf.writeBigUInt64BE(BigInt(timestamp))

  const saltBuf = Buffer.from(salt, 'base64')

  const payload = Buffer.concat([playerIdBuf, bundleIdBuf, timestampBuf, saltBuf])

  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(payload)

  const x509 = new crypto.X509Certificate(cert)
  return verifier.verify(x509.publicKey, signature, 'base64')
}

export async function authenticateSignature(
  em: EntityManager,
  integration: Integration,
  identifier: string,
): Promise<AuthenticateSignatureResult> {
  const errorOpts = { cause: 400 }

  let identity: GameCenterIdentity
  try {
    identity = JSON.parse(identifier) as GameCenterIdentity
  } catch {
    throw new Error(
      'Failed to authenticate Game Center identity: invalid identifier format',
      errorOpts,
    )
  }

  const config = integration.getGameCenterConfig()

  if (!identity.bundleId || identity.bundleId !== config.bundleId) {
    throw new Error('Failed to authenticate Game Center identity: bundle mismatch', errorOpts)
  }

  if (Date.now() - identity.timestamp > SIGNATURE_STALENESS_THRESHOLD_MS) {
    throw new Error('Failed to authenticate Game Center identity: signature expired', errorOpts)
  }

  const parsedUrl = URL.canParse(identity.publicKeyUrl) ? new URL(identity.publicKeyUrl) : null
  if (!parsedUrl || !parsedUrl.hostname.endsWith('.apple.com')) {
    throw new Error('Failed to authenticate Game Center identity: invalid URL', { cause: 400 })
  }

  const client = new GameCenterClient(integration)

  const { cert, event: fetchEvent } = await client.fetchCertificate(identity.publicKeyUrl)

  if (fetchEvent) {
    await em.persist(fetchEvent).flush()
  }

  if (!cert) {
    throw new Error('Failed to authenticate Game Center identity: service unavailable', {
      cause: 503,
    })
  }

  const valid = verifyGameCenterIdentity(cert, identity)

  if (!valid) {
    throw new Error('Failed to authenticate Game Center identity: invalid signature', errorOpts)
  }

  const { playerId } = identity

  const alias = await em.repo(PlayerAlias).findOne({
    service: PlayerAliasService.GAME_CENTER,
    identifier: playerId,
    player: {
      game: integration.game,
    },
  })

  if (alias) {
    return { playerId }
  } else {
    return { playerId, initialPlayerProps: [] }
  }
}
