import { createServer } from 'http'
import { WebSocket } from 'ws'
import TaloSocket from '../../../src/socket/index.js'
import { logRequest, logResponse } from '../../../src/socket/messages/socketLogger.js'
import SocketConnection from '../../../src/socket/socketConnection.js'
import SocketTicket from '../../../src/socket/socketTicket.js'
import createAPIKeyAndToken from '../../utils/createAPIKeyAndToken.js'

describe('Socket logger', () => {
  const consoleMock = vi.spyOn(console, 'info').mockImplementation(() => undefined)

  beforeAll(() => {
    vi.stubEnv('NODE_ENV', 'production')
  })

  afterEach(() => {
    consoleMock.mockReset()
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  async function createSocketConnection(): Promise<[SocketConnection, () => void]> {
    const [apiKey] = await createAPIKeyAndToken([])
    await em.persist(apiKey).flush()

    const ticket = new SocketTicket('')
    ticket.apiKey = apiKey
    ticket.devBuild = false

    const server = createServer()
    server.listen(0)

    const wss = new TaloSocket(server, em)
    // @ts-expect-error null also works
    const ws = new WebSocket(null, [], {})
    const conn = new SocketConnection(wss, ws, ticket, '0.0.0.0')

    return [conn, () => server.close()]
  }

  it('should log requests', async () => {
    const [conn, cleanup] = await createSocketConnection()

    logRequest(conn, JSON.stringify({ req: 'v1.fake', data: {} }))

    expect(consoleMock).toHaveBeenLastCalledWith('--> WSS v1.fake')

    cleanup()
  })

  it('should log requests without valid json', async () => {
    const [conn, cleanup] = await createSocketConnection()

    logRequest(conn, 'v1.fake')

    expect(consoleMock).toHaveBeenLastCalledWith('--> WSS unknown')

    cleanup()
  })

  it('should log requests without a req', async () => {
    const [conn, cleanup] = await createSocketConnection()

    logRequest(conn, JSON.stringify({ wrong: 'v1.fake' }))

    expect(consoleMock).toHaveBeenLastCalledWith('--> WSS unknown')

    cleanup()
  })

  it('should not log connected responses', async () => {
    const [conn, cleanup] = await createSocketConnection()

    logResponse(conn, 'v1.connected', JSON.stringify({ res: 'v1.connected', data: {} }))

    expect(consoleMock).not.toHaveBeenCalled()

    cleanup()
  })
})
