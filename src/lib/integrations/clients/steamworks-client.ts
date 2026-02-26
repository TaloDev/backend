import axios, { AxiosError, AxiosResponse } from 'axios'
import Integration from '../../../entities/integration'
import SteamworksIntegrationEvent from '../../../entities/steamworks-integration-event'

export type SteamworksRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type SteamworksResponseStatusCode = 200 | 400 | 401 | 403 | 404 | 405 | 429 | 500 | 503

export type SteamworksRequestConfig = {
  method: SteamworksRequestMethod
  baseURL: string
  url: string
  headers: {
    'x-webapi-key': string
  }
  data: string
}

export type SteamworksRequest = {
  url: string
  method: SteamworksRequestMethod
  body: string
}

export type SteamworksResponse = {
  status: SteamworksResponseStatusCode
  body: {
    [key: string]: unknown
  }
  timeTaken: number
}

export type FindOrCreateLeaderboardResponseLeaderboard = {
  leaderBoardID: number
  leaderboardName: string
  onlyfriendsreads: boolean
  onlytrustedwrites: boolean
  leaderBoardEntries: number
  leaderBoardSortMethod: 'Ascending' | 'Descending'
  leaderBoardDisplayType: 'Numeric'
}

export type FindOrCreateLeaderboardResponse = {
  result: {
    result: number
    leaderboard?: FindOrCreateLeaderboardResponseLeaderboard
  }
}

export type GetLeaderboardsForGameResponseLeaderboard = {
  id: number
  name: string
  entries: number
  sortmethod: 'Ascending' | 'Descending'
  displaytype: 'Numeric'
  onlyfriendsreads: boolean
  onlytrustedwrites: boolean
}

export type GetLeaderboardsForGameResponse = {
  response: {
    result: number
    leaderboards?: GetLeaderboardsForGameResponseLeaderboard[]
  }
}

export type GetLeaderboardEntriesResponse = {
  leaderboardEntryInformation: {
    appID: number
    leaderboardID: number
    totalLeaderBoardEntryCount: number
    leaderboardEntries: {
      steamID: string
      score: number
      rank: number
      ugcid: string
    }[]
  }
}

export type GetLeaderboardEntriesResponseEntry =
  GetLeaderboardEntriesResponse['leaderboardEntryInformation']['leaderboardEntries'][number]

export type SteamworksGameStat = {
  name: string
  defaultvalue: number
  displayName: string
}

export type GetSchemaForGameResponse = {
  game: {
    gameName: string
    gameVersion: string
    availableGameStats: {
      stats: SteamworksGameStat[]
      achievements: unknown[]
    }
  }
}

export type GetUserStatsForGameResponse = {
  playerstats: {
    steamID: string
    gameName: string
    stats: {
      name: string
      value: number
    }[]
    achievements: unknown[]
  }
}

export type AuthenticateUserTicketResponse = {
  response: {
    params?: {
      result: 'OK'
      steamid: string
      ownersteamid: string
      vacbanned: boolean
      publisherbanned: boolean
    }
    error?: {
      errorcode: number
      errordesc: string
    }
  }
}

export type CheckAppOwnershipResponse = {
  appownership: {
    ownsapp: boolean
    permanent: boolean
    timestamp: string
    ownersteamid: string
    sitelicense: boolean
    timedtrial: boolean
    usercanceled: boolean
    result: 'OK'
  }
}

export type GetPlayerSummariesResponse = {
  response: {
    players: {
      steamid: string
      personaname: string
      avatarhash: string
    }[]
  }
}

export class SteamworksNetworkError extends Error {
  constructor(
    public readonly event: SteamworksIntegrationEvent,
    cause: unknown,
  ) {
    super('Steamworks network error', { cause })
  }
}

export class SteamworksClient {
  constructor(private readonly integration: Integration) {}

  private createSteamworksRequestConfig({
    method,
    url,
    body = '',
  }: {
    method: SteamworksRequestMethod
    url: string
    body: string
  }): SteamworksRequestConfig {
    return {
      method,
      baseURL: 'https://partner.steam-api.com',
      url,
      headers: { 'x-webapi-key': this.integration.getSteamAPIKey() },
      data: body,
    }
  }

  private createSteamworksIntegrationEvent(config: SteamworksRequestConfig) {
    const event = new SteamworksIntegrationEvent(this.integration)
    event.request = {
      method: config.method,
      url: config.baseURL + config.url,
      body: config.data,
    }

    return event
  }

  async makeRequest<T>({
    method,
    url,
    body = '',
  }: {
    method: SteamworksRequestMethod
    url: string
    body?: string
  }): Promise<{
    res: AxiosResponse<T, SteamworksRequestConfig>
    event: SteamworksIntegrationEvent
  }> {
    const config = this.createSteamworksRequestConfig({ method, url, body })
    const event = this.createSteamworksIntegrationEvent(config)

    const startTime = performance.now()

    try {
      const res = await axios(config)
      const endTime = performance.now()

      event.response = {
        status: res.status as SteamworksResponseStatusCode,
        body: res.data,
        timeTaken: endTime - startTime,
      }

      return { res, event }
    } catch (err) {
      const endTime = performance.now()
      const axiosErr = err as AxiosError

      if (!axiosErr.response) {
        throw new SteamworksNetworkError(event, err)
      }

      event.response = {
        status: axiosErr.response.status as SteamworksResponseStatusCode,
        body: axiosErr.response.data as { [key: string]: unknown },
        timeTaken: endTime - startTime,
      }

      return { res: axiosErr.response as AxiosResponse, event }
    }
  }
}
