import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'
import { createSocketTicket } from '../../src/services/api/socket-ticket-api.service'
import createTestSocket from '../utils/createTestSocket'

describe('Socket server', () => {
  it('should send a connected message when sending an auth ticket', async () => {
    const [apiKey] = await createAPIKeyAndToken([])

    const ticket = await createSocketTicket(redis, apiKey, false)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.expectJsonToStrictEqual({
        res: 'v1.connected',
        data: {}
      })
    }, {
      waitForReady: false
    })
  })

  it('should close connections without an auth ticket', async () => {
    await createTestSocket('/', async (client) => {
      await client.expectClosed(3000)
    }, {
      waitForReady: false
    })
  })

  it('should close connections message when sending an invalid auth ticket', async () => {
    await createTestSocket('/?ticket=abc123', async (client) => {
      await client.expectClosed(3000)
    }, {
      waitForReady: false
    })
  })

  it('should close connections where the socket ticket has a revoked api key', async () => {
    const [apiKey] = await createAPIKeyAndToken([])
    apiKey.revokedAt = new Date()
    await em.flush()

    const ticket = await createSocketTicket(redis, apiKey, false)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.expectClosed(3000)
    }, {
      waitForReady: false
    })
  })
})
