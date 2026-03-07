import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import { IntegrationType } from '../../../src/entities/integration'
import { GooglePlayGamesClient } from '../../../src/lib/integrations/clients/google-play-games-client'
import IntegrationFactory from '../../fixtures/IntegrationFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'

async function createClient() {
  const [, game] = await createOrganisationAndGame()
  const integration = await new IntegrationFactory()
    .construct(IntegrationType.GOOGLE_PLAY_GAMES, game, {
      clientId: 'test-client-id',
      clientSecret: 'super-secret-value',
    })
    .one()
  await em.persist(integration).flush()
  return new GooglePlayGamesClient(integration)
}

describe('GooglePlayGamesClient - createIntegrationEvent', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterEach(() => {
    axiosMock.reset()
  })

  it('should not include the client_secret in a URLSearchParams event request body', async () => {
    const client = await createClient()

    axiosMock.onPost('https://oauth2.googleapis.com/token').reply(200, { access_token: 'abc' })

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'auth-code',
      client_id: 'test-client-id',
      client_secret: 'super-secret-value',
      redirect_uri: '',
    }).toString()

    const { event } = await client.makeRequest({
      method: 'POST',
      baseURL: 'https://oauth2.googleapis.com',
      url: '/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })

    const parsedBody = Object.fromEntries(new URLSearchParams(event.request.body))
    expect(parsedBody.client_secret).toBeUndefined()
    expect(parsedBody.grant_type).toBe('authorization_code')
    expect(parsedBody.code).toBe('auth-code')
    expect(parsedBody.client_id).toBe('test-client-id')
  })

  it('should not include the client_secret in a JSON event request body', async () => {
    const client = await createClient()

    axiosMock.onPost('https://oauth2.googleapis.com/token').reply(200, { access_token: 'abc' })

    const body = JSON.stringify({
      grant_type: 'authorization_code',
      code: 'auth-code',
      client_id: 'test-client-id',
      client_secret: 'super-secret-value',
      redirect_uri: '',
    })

    const { event } = await client.makeRequest({
      method: 'POST',
      baseURL: 'https://oauth2.googleapis.com',
      url: '/token',
      headers: { 'content-type': 'application/json' },
      body,
    })

    const parsedBody = JSON.parse(event.request.body)
    expect(parsedBody.client_secret).toBeUndefined()
    expect(parsedBody.grant_type).toBe('authorization_code')
    expect(parsedBody.code).toBe('auth-code')
    expect(parsedBody.client_id).toBe('test-client-id')
  })

  it('should handle events with no body (e.g. GET requests)', async () => {
    const client = await createClient()

    axiosMock
      .onGet('https://www.googleapis.com/games/v1/players/me')
      .reply(200, { playerId: 'player-123', displayName: 'Test Player' })

    const { event } = await client.makeRequest({
      method: 'GET',
      baseURL: 'https://www.googleapis.com',
      url: '/games/v1/players/me',
      headers: { Authorization: 'Bearer some-token' },
    })

    expect(event.request.body).toBe('')
  })
})

describe('GooglePlayGamesClient - retry mechanism', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterEach(() => {
    axiosMock.reset()
  })

  it('should succeed on the first attempt without retrying', async () => {
    const client = await createClient()

    const mock = vi.fn(() => [200, { playerId: 'player-123' }])
    axiosMock.onGet('https://www.googleapis.com/games/v1/players/me').reply(mock)

    await client.makeRequest({
      method: 'GET',
      baseURL: 'https://www.googleapis.com',
      url: '/games/v1/players/me',
    })

    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('should retry after a network error and succeed on the second attempt', async () => {
    const client = await createClient()

    const successMock = vi.fn(() => [200, { playerId: 'player-123' }])
    axiosMock
      .onGet('https://www.googleapis.com/games/v1/players/me')
      .networkErrorOnce()
      .onGet('https://www.googleapis.com/games/v1/players/me')
      .reply(successMock)

    const { res } = await client.makeRequest({
      method: 'GET',
      baseURL: 'https://www.googleapis.com',
      url: '/games/v1/players/me',
    })

    expect(successMock).toHaveBeenCalledTimes(1)
    expect(res?.status).toBe(200)
  })

  it('should retry up to 2 times and return null res after all attempts fail', async () => {
    const client = await createClient()

    axiosMock.onGet('https://www.googleapis.com/games/v1/players/me').networkError()

    const { res, event } = await client.makeRequest({
      method: 'GET',
      baseURL: 'https://www.googleapis.com',
      url: '/games/v1/players/me',
    })

    expect(res).toBeNull()
    expect(event.response.status).toBe(503)
    expect(event.response.body).toMatchObject({ error: expect.any(String) })
    expect(event.response.timeTaken).toBeGreaterThan(0)
  })

  it('should make exactly 3 attempts (1 initial + 2 retries) before failing', async () => {
    const client = await createClient()

    let callCount = 0
    axiosMock.onGet('https://www.googleapis.com/games/v1/players/me').reply(() => {
      callCount++
      throw new Error('Network error')
    })

    const { res } = await client.makeRequest({
      method: 'GET',
      baseURL: 'https://www.googleapis.com',
      url: '/games/v1/players/me',
    })

    expect(res).toBeNull()
    expect(callCount).toBe(3)
  })

  it('should succeed on the third attempt after two network errors', async () => {
    const client = await createClient()

    const successMock = vi.fn(() => [200, { playerId: 'player-123' }])
    axiosMock
      .onGet('https://www.googleapis.com/games/v1/players/me')
      .networkErrorOnce()
      .onGet('https://www.googleapis.com/games/v1/players/me')
      .networkErrorOnce()
      .onGet('https://www.googleapis.com/games/v1/players/me')
      .reply(successMock)

    const { res } = await client.makeRequest({
      method: 'GET',
      baseURL: 'https://www.googleapis.com',
      url: '/games/v1/players/me',
    })

    expect(successMock).toHaveBeenCalledTimes(1)
    expect(res?.status).toBe(200)
  })

  it('should not retry 4xx HTTP error responses', async () => {
    const client = await createClient()

    const mock = vi.fn(() => [400, { error: 'Bad Request' }])
    axiosMock.onGet('https://www.googleapis.com/games/v1/players/me').reply(mock)

    const { res } = await client.makeRequest({
      method: 'GET',
      baseURL: 'https://www.googleapis.com',
      url: '/games/v1/players/me',
    })

    expect(mock).toHaveBeenCalledTimes(1)
    expect(res?.status).toBe(400)
  })

  it('should retry 5xx HTTP error responses above 500', async () => {
    const client = await createClient()

    const successMock = vi.fn(() => [200, { playerId: 'player-123' }])
    axiosMock
      .onGet('https://www.googleapis.com/games/v1/players/me')
      .replyOnce(502, { error: 'Bad Gateway' })
      .onGet('https://www.googleapis.com/games/v1/players/me')
      .reply(successMock)

    const { res } = await client.makeRequest({
      method: 'GET',
      baseURL: 'https://www.googleapis.com',
      url: '/games/v1/players/me',
    })

    expect(successMock).toHaveBeenCalledTimes(1)
    expect(res?.status).toBe(200)
  })

  it('should not retry 500 HTTP error responses', async () => {
    const client = await createClient()

    const mock = vi.fn(() => [500, { error: 'Internal Server Error' }])
    axiosMock.onGet('https://www.googleapis.com/games/v1/players/me').reply(mock)

    const { res } = await client.makeRequest({
      method: 'GET',
      baseURL: 'https://www.googleapis.com',
      url: '/games/v1/players/me',
    })

    expect(mock).toHaveBeenCalledTimes(1)
    expect(res?.status).toBe(500)
  })

  it(
    'should use the longer abort timeout only on the final attempt',
    { timeout: 15_000 },
    async () => {
      const client = await createClient()

      let callCount = 0

      axiosMock
        .onGet('https://www.googleapis.com/games/v1/players/me')
        .reply(async (axiosConfig) => {
          callCount++
          if (callCount < 3) {
            await new Promise((_, reject) => {
              const signal = axiosConfig.signal as AbortSignal
              signal.addEventListener('abort', () =>
                reject(new DOMException('The operation was aborted.', 'AbortError')),
              )
            })
          }
          // respond after 1500ms — exceeds the 1000ms early timeout but within the 5000ms final timeout
          await new Promise((resolve) => setTimeout(resolve, 1500))
          return [200, { playerId: 'player-123' }]
        })

      const { res } = await client.makeRequest({
        method: 'GET',
        baseURL: 'https://www.googleapis.com',
        url: '/games/v1/players/me',
      })

      expect(callCount).toBe(3)
      expect(res?.status).toBe(200)
    },
  )

  it('should abort the request after 1000ms and retry', { timeout: 10_000 }, async () => {
    const client = await createClient()

    let callCount = 0
    const successMock = vi.fn(() => [200, { playerId: 'player-123' }])

    axiosMock.onGet('https://www.googleapis.com/games/v1/players/me').reply(async (axiosConfig) => {
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

    const { res } = await client.makeRequest({
      method: 'GET',
      baseURL: 'https://www.googleapis.com',
      url: '/games/v1/players/me',
    })

    expect(callCount).toBe(2)
    expect(successMock).toHaveBeenCalledTimes(1)
    expect(res?.status).toBe(200)
  })
})
