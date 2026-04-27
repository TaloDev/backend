import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import assert from 'node:assert'
import { IntegrationType } from '../../../src/entities/integration'
import {
  clearCertCache,
  GameCenterClient,
} from '../../../src/lib/integrations/clients/game-center-client'
import IntegrationFactory from '../../fixtures/IntegrationFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'

const publicKeyURL = 'https://static.gc.apple.com/public-key/gc-prod-6.cer'

async function createClient() {
  const [, game] = await createOrganisationAndGame()
  const integration = await new IntegrationFactory()
    .construct(IntegrationType.GAME_CENTER, game, { bundleId: 'com.example.game' })
    .one()
  await em.persist(integration).flush()
  return new GameCenterClient(integration)
}

describe('GameCenterClient - retry mechanism', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  beforeEach(() => {
    clearCertCache()
  })

  afterEach(() => {
    axiosMock.reset()
  })

  it('should succeed on the first attempt without retrying', async () => {
    const client = await createClient()

    const certData = Buffer.from('fake-cert-data')
    const mock = vi.fn(() => [200, certData])
    axiosMock.onGet(publicKeyURL).reply(mock)

    await client.fetchCertificate(publicKeyURL)

    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('should retry after a network error and succeed on the second attempt', async () => {
    const client = await createClient()

    const certData = Buffer.from('fake-cert-data')
    const successMock = vi.fn(() => [200, certData])
    axiosMock.onGet(publicKeyURL).networkErrorOnce().onGet(publicKeyURL).reply(successMock)

    const { cert } = await client.fetchCertificate(publicKeyURL)

    expect(successMock).toHaveBeenCalledTimes(1)
    expect(cert).toBeInstanceOf(Buffer)
  })

  it('should retry up to 2 times and return null cert after all attempts fail', async () => {
    const client = await createClient()

    axiosMock.onGet(publicKeyURL).networkError()

    const { cert } = await client.fetchCertificate(publicKeyURL)
    expect(cert).toBeNull()
  })

  it('should make exactly 3 attempts (1 initial + 2 retries) before failing', async () => {
    const client = await createClient()

    let callCount = 0
    axiosMock.onGet(publicKeyURL).reply(() => {
      callCount++
      throw new Error('Network error')
    })

    const { cert } = await client.fetchCertificate(publicKeyURL)
    expect(cert).toBeNull()
    expect(callCount).toBe(3)
  })

  it('should succeed on the third attempt after two network errors', async () => {
    const client = await createClient()

    const certData = Buffer.from('fake-cert-data')
    const successMock = vi.fn(() => [200, certData])
    axiosMock
      .onGet(publicKeyURL)
      .networkErrorOnce()
      .onGet(publicKeyURL)
      .networkErrorOnce()
      .onGet(publicKeyURL)
      .reply(successMock)

    const { cert } = await client.fetchCertificate(publicKeyURL)

    expect(successMock).toHaveBeenCalledTimes(1)
    expect(cert).toBeInstanceOf(Buffer)
  })

  it('should not retry 4xx HTTP error responses', async () => {
    const client = await createClient()

    const mock = vi.fn(() => [400, Buffer.from('')])
    axiosMock.onGet(publicKeyURL).reply(mock)

    const { cert } = await client.fetchCertificate(publicKeyURL)
    expect(cert).toBeNull()
    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('should record the response body on HTTP error', async () => {
    const client = await createClient()

    axiosMock.onGet(publicKeyURL).reply(400, { error: 'not found' })

    const { event } = await client.fetchCertificate(publicKeyURL)
    assert(event)
    expect(event.response?.body).toStrictEqual({ error: 'not found' })
  })

  it('should retry 5xx HTTP error responses above 500', async () => {
    const client = await createClient()

    const certData = Buffer.from('fake-cert-data')
    const successMock = vi.fn(() => [200, certData])
    axiosMock
      .onGet(publicKeyURL)
      .replyOnce(502, Buffer.from(''))
      .onGet(publicKeyURL)
      .reply(successMock)

    const { cert } = await client.fetchCertificate(publicKeyURL)

    expect(successMock).toHaveBeenCalledTimes(1)
    expect(cert).toBeInstanceOf(Buffer)
  })

  it('should not retry 500 HTTP error responses', async () => {
    const client = await createClient()

    const mock = vi.fn(() => [500, Buffer.from('')])
    axiosMock.onGet(publicKeyURL).reply(mock)

    const { cert } = await client.fetchCertificate(publicKeyURL)
    expect(cert).toBeNull()
    expect(mock).toHaveBeenCalledTimes(1)
  })

  it(
    'should use the longer abort timeout only on the final attempt',
    { timeout: 15_000 },
    async () => {
      const client = await createClient()

      let callCount = 0

      axiosMock.onGet(publicKeyURL).reply(async (axiosConfig) => {
        callCount++
        if (callCount < 3) {
          await new Promise((_, reject) => {
            const signal = axiosConfig.signal as AbortSignal
            signal.addEventListener('abort', () =>
              reject(new DOMException('The operation was aborted.', 'AbortError')),
            )
          })
        }
        // respond after 3000ms — exceeds the 2000ms early timeout but within the 5000ms final timeout
        await new Promise((resolve) => setTimeout(resolve, 3000))
        return [200, Buffer.from('fake-cert-data')]
      })

      const { cert } = await client.fetchCertificate(publicKeyURL)

      expect(callCount).toBe(3)
      expect(cert).toBeInstanceOf(Buffer)
    },
  )

  it('should abort the request after 2000ms and retry', { timeout: 10_000 }, async () => {
    const client = await createClient()

    let callCount = 0
    const certData = Buffer.from('fake-cert-data')
    const successMock = vi.fn(() => [200, certData])

    axiosMock.onGet(publicKeyURL).reply(async (axiosConfig) => {
      callCount++
      if (callCount === 1) {
        await new Promise((_, reject) => {
          const signal = axiosConfig.signal as AbortSignal
          signal.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          )
        })
      }
      return successMock()
    })

    const { cert } = await client.fetchCertificate(publicKeyURL)

    expect(callCount).toBe(2)
    expect(successMock).toHaveBeenCalledTimes(1)
    expect(cert).toBeInstanceOf(Buffer)
  })
})
