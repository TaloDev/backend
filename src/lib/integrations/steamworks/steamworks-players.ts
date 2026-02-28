import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import assert from 'node:assert'
import Integration from '../../../entities/integration'
import PlayerAlias, { PlayerAliasService } from '../../../entities/player-alias'
import {
  AuthenticateUserTicketResponse,
  CheckAppOwnershipResponse,
  GetPlayerSummariesResponse,
  SteamworksClient,
} from '../clients/steamworks-client'

async function requestAuthenticateUserTicket({
  em,
  integration,
  ticket,
  identity,
}: {
  em: EntityManager
  integration: Integration
  ticket: string
  identity?: string
}) {
  const client = new SteamworksClient(integration)
  const { res, event } = await client.makeRequest<AuthenticateUserTicketResponse>({
    method: 'GET',
    url: `/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${integration.getConfig().appId}&ticket=${ticket}${identity ? `&identity=${identity}` : ''}`,
  })
  await em.persist(event).flush()

  // set the cause to 400 so the api doesn't return a 500
  const errorOpts = { cause: 400 }

  if (!res || res.status >= 500) {
    throw new Error('Failed to authenticate Steamworks ticket: Steam service unavailable', {
      cause: 503,
    })
  } else if (res.data?.response?.error) {
    const message = `Failed to authenticate Steamworks ticket: ${res.data.response.error.errordesc} (${res.data.response.error.errorcode})`
    throw new Error(message, errorOpts)
  } else if (res.status === 403) {
    throw new Error('Failed to authenticate Steamworks ticket: Invalid API key', errorOpts)
  } else if (!res.data?.response?.params) {
    throw new Error(
      'Failed to authenticate Steamworks ticket: Invalid response from Steamworks',
      errorOpts,
    )
  }

  return { status: res.status, data: res.data }
}

export type AuthenticateTicketResult = {
  steamId: string
  initialPlayerProps?: { key: string; value: string }[]
}

export async function authenticateTicket(
  em: EntityManager,
  integration: Integration,
  identifier: string,
): Promise<AuthenticateTicketResult> {
  const parts = identifier.split(':')
  const identity = parts.length > 1 ? parts[0] : undefined
  const ticket = parts.at(-1)
  // this assert shouldn't fail since identify() checks for empty identifiers
  assert(ticket, 'Missing Steamworks ticket')

  const { data: authenticateData } = await requestAuthenticateUserTicket({
    em,
    integration,
    ticket,
    identity,
  })

  const authenticateParams = authenticateData.response.params!
  const steamId = authenticateParams.steamid

  // set the cause to 400 so the api doesn't return a 500
  const errorOpts = { cause: 400 }
  const alias = await em.repo(PlayerAlias).findOne({
    service: PlayerAliasService.STEAM,
    identifier: steamId,
    player: {
      game: integration.game,
    },
  })

  const [{ status: verifyOwnershipStatus, data: verifyOwnershipData }, playerSummary] =
    await Promise.all([
      verifyOwnership({ em, integration, steamId }),
      getPlayerSummary({ em, integration, steamId }),
    ])

  if (verifyOwnershipStatus === 403) {
    throw new Error('Failed to verify Steamworks ownership: Invalid API key', errorOpts)
  }

  const { ownsapp, permanent, timestamp } = verifyOwnershipData.appownership
  const { vacbanned, publisherbanned } = authenticateParams

  const props = [
    { key: 'META_STEAMWORKS_VAC_BANNED', value: String(vacbanned) },
    { key: 'META_STEAMWORKS_PUBLISHER_BANNED', value: String(publisherbanned) },
    { key: 'META_STEAMWORKS_OWNS_APP', value: String(ownsapp) },
    { key: 'META_STEAMWORKS_OWNS_APP_PERMANENTLY', value: String(permanent) },
    { key: 'META_STEAMWORKS_OWNS_APP_FROM_DATE', value: timestamp },
  ]

  if (playerSummary) {
    props.push({ key: 'META_STEAMWORKS_PERSONA_NAME', value: playerSummary.personaname })
    props.push({ key: 'META_STEAMWORKS_AVATAR_HASH', value: playerSummary.avatarhash })
  } else {
    captureException(new Error('Failed to find Steamworks player summary'), {
      extra: {
        steamId,
        integrationId: integration.id,
      },
    })
  }

  if (alias) {
    for (const prop of props) {
      alias.player.upsertProp(prop.key, prop.value)
    }
    await em.flush()
    return { steamId }
  } else {
    return { steamId, initialPlayerProps: props }
  }
}

export async function verifyOwnership({
  em,
  integration,
  steamId,
}: {
  em: EntityManager
  integration: Integration
  steamId: string
}) {
  const client = new SteamworksClient(integration)
  const { res, event } = await client.makeRequest<CheckAppOwnershipResponse>({
    method: 'GET',
    url: `/ISteamUser/CheckAppOwnership/v3?appid=${integration.getConfig().appId}&steamid=${steamId}`,
  })
  await em.persist(event).flush()

  if (!res || res.status >= 500) {
    throw new Error('Failed to verify Steamworks ownership: Steam service unavailable', {
      cause: 503,
    })
  }

  if (res.status === 200 && !res.data?.appownership) {
    throw new Error('Failed to verify Steamworks ownership: Invalid response from Steamworks', {
      cause: 400,
    })
  }

  return { status: res.status, data: res.data }
}

export async function getPlayerSummary({
  em,
  integration,
  steamId,
}: {
  em: EntityManager
  integration: Integration
  steamId: string
}): Promise<GetPlayerSummariesResponse['response']['players'][number] | null> {
  const client = new SteamworksClient(integration)
  const { res, event } = await client.makeRequest<GetPlayerSummariesResponse>({
    method: 'GET',
    url: `/ISteamUser/GetPlayerSummaries/v2?steamids=${steamId}`,
  })
  await em.persist(event).flush()

  if (!res || res.status !== 200) {
    return null
  }

  if (!Array.isArray(res.data?.response?.players)) {
    return null
  }

  return res.data.response.players.find((p) => p.steamid === steamId) ?? null
}
