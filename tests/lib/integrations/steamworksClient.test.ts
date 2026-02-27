import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import { IntegrationType } from '../../../src/entities/integration'
import { SteamworksClient } from '../../../src/lib/integrations/clients/steamworks-client'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../fixtures/IntegrationFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'

describe('SteamworksClient - retry mechanism', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterEach(() => {
    axiosMock.reset()
  })

  it('should succeed on the first attempt without retrying', async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    const mock = vi.fn(() => [200, { response: { result: 1 } }])
    axiosMock.onGet('https://partner.steam-api.com/test').reply(mock)

    const client = new SteamworksClient(integration)
    await client.makeRequest({ method: 'GET', url: '/test' })

    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('should retry after a network error and succeed on the second attempt', async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    const successMock = vi.fn(() => [200, { response: { result: 1 } }])
    axiosMock
      .onGet('https://partner.steam-api.com/test')
      .networkErrorOnce()
      .onGet('https://partner.steam-api.com/test')
      .reply(successMock)

    const client = new SteamworksClient(integration)
    const { res } = await client.makeRequest({ method: 'GET', url: '/test' })

    expect(successMock).toHaveBeenCalledTimes(1)
    expect(res?.status).toBe(200)
  })

  it('should retry up to 2 times and return success: false after all attempts fail', async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    axiosMock.onGet('https://partner.steam-api.com/test').networkError()

    const client = new SteamworksClient(integration)
    const { res, event, success } = await client.makeRequest({ method: 'GET', url: '/test' })

    expect(success).toBe(false)
    expect(res).toBeNull()
    expect(event.response.status).toBe(503)
    expect(event.response.body).toMatchObject({ error: expect.any(String) })
    expect(event.response.timeTaken).toBeGreaterThan(0)
  })

  it('should make exactly 3 attempts (1 initial + 2 retries) before failing', async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    let callCount = 0
    axiosMock.onGet('https://partner.steam-api.com/test').reply(() => {
      callCount++
      throw new Error('Network error')
    })

    const client = new SteamworksClient(integration)
    const { success } = await client.makeRequest({ method: 'GET', url: '/test' })

    expect(success).toBe(false)
    expect(callCount).toBe(3)
  })

  it('should succeed on the third attempt after two network errors', async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    const successMock = vi.fn(() => [200, { response: { result: 1 } }])
    axiosMock
      .onGet('https://partner.steam-api.com/test')
      .networkErrorOnce()
      .onGet('https://partner.steam-api.com/test')
      .networkErrorOnce()
      .onGet('https://partner.steam-api.com/test')
      .reply(successMock)

    const client = new SteamworksClient(integration)
    const { res } = await client.makeRequest({ method: 'GET', url: '/test' })

    expect(successMock).toHaveBeenCalledTimes(1)
    expect(res?.status).toBe(200)
  })

  it('should not retry 4xx HTTP error responses', async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    const mock = vi.fn(() => [400, { error: 'Bad Request' }])
    axiosMock.onGet('https://partner.steam-api.com/test').reply(mock)

    const client = new SteamworksClient(integration)
    const { res } = await client.makeRequest({ method: 'GET', url: '/test' })

    expect(mock).toHaveBeenCalledTimes(1)
    expect(res?.status).toBe(400)
  })

  it('should retry 5xx HTTP error responses above 500', async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    const successMock = vi.fn(() => [200, { response: { result: 1 } }])
    axiosMock
      .onGet('https://partner.steam-api.com/test')
      .replyOnce(502, { error: 'Bad Gateway' })
      .onGet('https://partner.steam-api.com/test')
      .reply(successMock)

    const client = new SteamworksClient(integration)
    const { res } = await client.makeRequest({ method: 'GET', url: '/test' })

    expect(successMock).toHaveBeenCalledTimes(1)
    expect(res?.status).toBe(200)
  })

  it('should not retry 500 HTTP error responses', async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    const mock = vi.fn(() => [500, { error: 'Internal Server Error' }])
    axiosMock.onGet('https://partner.steam-api.com/test').reply(mock)

    const client = new SteamworksClient(integration)
    const { res } = await client.makeRequest({ method: 'GET', url: '/test' })

    expect(mock).toHaveBeenCalledTimes(1)
    expect(res?.status).toBe(500)
  })

  it('should abort the request after 1000ms and retry', { timeout: 10_000 }, async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    let callCount = 0
    const successMock = vi.fn(() => [200, { response: { result: 1 } }])

    axiosMock.onGet('https://partner.steam-api.com/test').reply(async (axiosConfig) => {
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

    const client = new SteamworksClient(integration)
    const { res } = await client.makeRequest({ method: 'GET', url: '/test' })

    expect(callCount).toBe(2)
    expect(successMock).toHaveBeenCalledTimes(1)
    expect(res?.status).toBe(200)
  })
})
