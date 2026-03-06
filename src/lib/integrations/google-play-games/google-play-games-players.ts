import { EntityManager } from '@mikro-orm/mysql'
import Integration from '../../../entities/integration'
import PlayerAlias, { PlayerAliasService } from '../../../entities/player-alias'
import {
  ExchangeAuthCodeResponse,
  GetPlayerResponse,
  GooglePlayGamesClient,
} from '../clients/google-play-games-client'

export type AuthenticateAuthCodeResult = {
  playerId: string
  initialPlayerProps?: { key: string; value: string }[]
}

export async function authenticateAuthCode(
  em: EntityManager,
  integration: Integration,
  authCode: string,
): Promise<AuthenticateAuthCodeResult> {
  const client = new GooglePlayGamesClient(integration)
  const config = integration.getGooglePlayGamesConfig()

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    client_id: config.clientId,
    client_secret: integration.getGooglePlayGamesClientSecret(),
    redirect_uri: '',
  }).toString()

  const { res: tokenRes, event: tokenEvent } = await client.makeRequest<ExchangeAuthCodeResponse>({
    method: 'POST',
    baseURL: 'https://oauth2.googleapis.com',
    url: '/token',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: tokenBody,
  })
  await em.persist(tokenEvent).flush()

  const errorOpts = { cause: 400 }

  if (!tokenRes || tokenRes.status >= 500) {
    throw new Error('Failed to exchange Google Play Games auth code: service unavailable', {
      cause: 503,
    })
  }

  if (tokenRes.status !== 200 || !tokenRes.data?.access_token) {
    throw new Error(
      'Failed to exchange Google Play Games auth code: invalid response from Google',
      errorOpts,
    )
  }

  const accessToken = tokenRes.data.access_token

  const { res: playerRes, event: playerEvent } = await client.makeRequest<GetPlayerResponse>({
    method: 'GET',
    baseURL: 'https://www.googleapis.com',
    url: '/games/v1/players/me',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  await em.persist(playerEvent).flush()

  if (!playerRes || playerRes.status >= 500) {
    throw new Error('Failed to get Google Play Games player info: service unavailable', {
      cause: 503,
    })
  }

  if (playerRes.status !== 200 || !playerRes.data?.playerId) {
    throw new Error(
      'Failed to get Google Play Games player info: invalid response from Google',
      errorOpts,
    )
  }

  const { playerId, displayName, avatarImageUrl } = playerRes.data

  const props = [
    { key: 'META_GOOGLE_PLAY_GAMES_PLAYER_ID', value: playerId },
    { key: 'META_GOOGLE_PLAY_GAMES_DISPLAY_NAME', value: displayName },
    ...(avatarImageUrl
      ? [{ key: 'META_GOOGLE_PLAY_GAMES_AVATAR_URL', value: avatarImageUrl }]
      : []),
  ]

  const alias = await em.repo(PlayerAlias).findOne({
    service: PlayerAliasService.GOOGLE_PLAY_GAMES,
    identifier: playerId,
    player: {
      game: integration.game,
    },
  })

  if (alias) {
    for (const prop of props) {
      alias.player.upsertProp(prop.key, prop.value)
    }
    await em.flush()
    return { playerId }
  } else {
    return { playerId, initialPlayerProps: props }
  }
}
