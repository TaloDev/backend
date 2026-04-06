import axios, { AxiosError, AxiosResponse } from 'axios'
import pRetry, { AbortError } from 'p-retry'
import GameCenterIntegrationEvent from '../../../entities/game-center-integration-event'
import Integration from '../../../entities/integration'

type FetchCertificateResult = {
  res: AxiosResponse<ArrayBuffer> | null
  cert: Buffer | null
  event: GameCenterIntegrationEvent | null
}

// mapped by publicKeyURL
const certCache = new Map<string, { cert: Buffer; expiresAt: number }>()

// 1 day fallback if no cache headers
const DEFAULT_CERT_TTL_MS = 86_400_000

// only used in tests
export function clearCertCache() {
  certCache.clear()
}

export class GameCenterClient {
  constructor(private readonly integration: Integration) {}

  async fetchCertificate(publicKeyURL: string): Promise<FetchCertificateResult> {
    const cached = certCache.get(publicKeyURL)
    if (cached && Date.now() < cached.expiresAt) {
      return { res: null, cert: cached.cert, event: null }
    }

    const event = new GameCenterIntegrationEvent(this.integration)
    event.request = { method: 'GET', url: publicKeyURL }

    const totalAttempts = 3
    const abortTimeout = 2000
    const finalAbortTimeout = 5000

    const startTime = performance.now()

    try {
      const response = await pRetry(
        async (attemptNumber) => {
          const isLastAttempt = attemptNumber === totalAttempts
          const controller = new AbortController()
          const timeout = setTimeout(
            () => controller.abort(),
            isLastAttempt ? finalAbortTimeout : abortTimeout,
          )
          try {
            return await axios.get<ArrayBuffer>(publicKeyURL, {
              responseType: 'arraybuffer',
              signal: controller.signal,
            })
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
                `Game Center GET ${publicKeyURL} failed (attempt ${attemptNumber}/${totalAttempts}), retrying`,
              )
            }
          },
        },
      )
      const endTime = performance.now()

      const cert = Buffer.from(response.data)
      let ttl = DEFAULT_CERT_TTL_MS

      const cacheControl = response.headers['cache-control']
      if (cacheControl) {
        const match = cacheControl.match(/max-age=(\d+)/)
        if (match) {
          ttl = parseInt(match[1], 10) * 1000
        }
      }

      certCache.set(publicKeyURL, { cert, expiresAt: Date.now() + ttl })

      event.response = { status: response.status, body: {}, timeTaken: endTime - startTime }
      return { res: response, cert, event }
    } catch (err) {
      const endTime = performance.now()
      const axiosErr = err as AxiosError

      if (!axiosErr.response) {
        event.response = {
          status: 503,
          body: { error: axiosErr.message },
          timeTaken: endTime - startTime,
        }
        return { res: null, cert: null, event }
      }

      event.response = {
        status: axiosErr.response.status,
        body: axiosErr.response.data as { [key: string]: unknown },
        timeTaken: endTime - startTime,
      }
      return { res: axiosErr.response as AxiosResponse<ArrayBuffer>, cert: null, event }
    }
  }
}
