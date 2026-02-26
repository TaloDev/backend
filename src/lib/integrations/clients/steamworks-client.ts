import axios, { AxiosError, AxiosResponse } from 'axios'
import pRetry, { AbortError } from 'p-retry'
import Integration from '../../../entities/integration'
import SteamworksIntegrationEvent, {
  SteamworksRequestMethod,
} from '../../../entities/steamworks-integration-event'

export type SteamworksRequestConfig = {
  method: SteamworksRequestMethod
  baseURL: string
  url: string
  headers: {
    'x-webapi-key': string
  }
  data: string
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
    body,
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

  async makeRequest<T extends { [key: string]: unknown }>({
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

    const retryTimeout = 100
    const abortTimeout = 1000

    const startTime = performance.now()

    try {
      const res = await pRetry(
        async () => {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), abortTimeout)
          try {
            return await axios<T>({ ...config, signal: controller.signal })
          } catch (err) {
            const axiosErr = err as AxiosError
            if (axiosErr.response && axiosErr.response.status <= 500) throw new AbortError(axiosErr)
            throw err
          } finally {
            clearTimeout(timeout)
          }
        },
        {
          retries: 2,
          minTimeout: retryTimeout,
          maxTimeout: retryTimeout,
          onFailedAttempt: ({ attemptNumber, retriesLeft }) => {
            if (retriesLeft > 0) {
              console.info(
                `Steamworks ${config.method} ${config.baseURL + config.url} failed (attempt ${attemptNumber}/3), retrying in ${retryTimeout}ms (${retriesLeft} left)`,
              )
            }
          },
        },
      )
      const endTime = performance.now()

      event.response = {
        status: res.status,
        body: res.data,
        timeTaken: endTime - startTime,
      }

      return { res, event }
    } catch (err) {
      const endTime = performance.now()
      const axiosErr = err as AxiosError

      if (!axiosErr.response) {
        event.response = {
          status: 503,
          body: { error: axiosErr.message },
          timeTaken: endTime - startTime,
        }
        throw new SteamworksNetworkError(event, err)
      }

      event.response = {
        status: axiosErr.response.status,
        body: axiosErr.response.data as { [key: string]: unknown },
        timeTaken: endTime - startTime,
      }

      return { res: axiosErr.response as AxiosResponse, event }
    }
  }
}
