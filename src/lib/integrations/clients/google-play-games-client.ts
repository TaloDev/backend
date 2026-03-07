import axios, { AxiosError, AxiosResponse } from 'axios'
import pRetry, { AbortError } from 'p-retry'
import GooglePlayGamesIntegrationEvent, {
  GooglePlayGamesRequest,
} from '../../../entities/google-play-games-integration-event'
import Integration from '../../../entities/integration'

export type GooglePlayGamesRequestConfig = {
  method: GooglePlayGamesRequest['method']
  baseURL: string
  url: string
  headers: Record<string, string>
  data: string
}

export type ExchangeAuthCodeResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

export type GetPlayerResponse = {
  playerId: string
  displayName: string
  avatarImageUrl?: string
}

export class GooglePlayGamesClient {
  constructor(private readonly integration: Integration) {}

  private createRequestConfig({
    method,
    baseURL,
    url,
    headers,
    body,
  }: {
    method: GooglePlayGamesRequest['method']
    baseURL: string
    url: string
    headers: Record<string, string>
    body: string
  }): GooglePlayGamesRequestConfig {
    return {
      method,
      baseURL,
      url,
      headers,
      data: body,
    }
  }

  private createIntegrationEvent(config: GooglePlayGamesRequestConfig) {
    const event = new GooglePlayGamesIntegrationEvent(this.integration)
    event.request = {
      method: config.method,
      url: config.baseURL + config.url,
      body: config.data,
    } as GooglePlayGamesRequest

    // filter out secrets
    if (event.request.body) {
      try {
        const body = JSON.parse(event.request.body)
        body.client_secret = undefined
        event.request.body = JSON.stringify(body)
      } catch {
        const params = new URLSearchParams(event.request.body)
        params.delete('client_secret')
        event.request.body = params.toString()
      }
    }

    return event
  }

  async makeRequest<T extends { [key: string]: unknown }>({
    method,
    baseURL,
    url,
    headers = {},
    body = '',
  }: {
    method: GooglePlayGamesRequest['method']
    baseURL: string
    url: string
    headers?: Record<string, string>
    body?: string
  }): Promise<{
    res: AxiosResponse<T, GooglePlayGamesRequestConfig> | null
    event: GooglePlayGamesIntegrationEvent
  }> {
    const config = this.createRequestConfig({ method, baseURL, url, headers, body })
    const event = this.createIntegrationEvent(config)

    const totalAttempts = 3
    const abortTimeout = 1000
    const finalAbortTimeout = 5000

    const startTime = performance.now()

    try {
      const res = await pRetry(
        async (attemptNumber) => {
          const isLastAttempt = attemptNumber === totalAttempts
          const controller = new AbortController()
          const timeout = setTimeout(
            () => controller.abort(),
            isLastAttempt ? finalAbortTimeout : abortTimeout,
          )
          try {
            return await axios<T>({ ...config, signal: controller.signal })
          } catch (err) {
            const axiosErr = err as AxiosError
            if (axiosErr.response && axiosErr.response.status <= 500) {
              throw new AbortError(axiosErr)
            }
            throw err
          } finally {
            clearTimeout(timeout)
          }
        },
        {
          retries: totalAttempts - 1,
          minTimeout: 100,
          maxTimeout: 1000,
          onFailedAttempt: ({ attemptNumber, retriesLeft }) => {
            if (retriesLeft > 0) {
              console.info(
                `Google Play Games ${config.method} ${config.baseURL + config.url} failed (attempt ${attemptNumber}/${totalAttempts}), retrying`,
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
        return { res: null, event }
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
