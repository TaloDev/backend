import { WebSocket } from 'ws'
import TaloSocket from '../../../src/socket'
import SocketConnection from '../../../src/socket/socketConnection'
import createAPIKeyAndToken from '../../utils/createAPIKeyAndToken'
import { createServer, IncomingMessage } from 'http'
import { Socket } from 'net'
import { logConnection, logConnectionClosed, logRequest, logResponse } from '../../../src/socket/messages/socketLogger'
import SocketTicket from '../../../src/socket/socketTicket'

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
    await em.persistAndFlush(apiKey)

    const ticket = new SocketTicket('')
    ticket.apiKey = apiKey
    ticket.devBuild = false

    const server = createServer()
    server.listen(0)

    const wss = new TaloSocket(server, em)
    // @ts-expect-error null also works
    const ws = new WebSocket(null, [], {})
    const conn = new SocketConnection(wss, ws, ticket, '0.0.0.0')

    return [
      conn,
      () => server.close()
    ]
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

  it('should log responses', async () => {
    const [conn, cleanup] = await createSocketConnection()

    logResponse(conn, 'v1.players.identify.success', JSON.stringify({ res: 'v1.players.identify.success', data: {} }))

    expect(consoleMock).toHaveBeenLastCalledWith('<-- WSS v1.players.identify.success')

    cleanup()
  })

  it('should log connections', async () => {
    logConnection(new IncomingMessage(new Socket()))

    expect(consoleMock).toHaveBeenLastCalledWith('--> WSS open')
  })

  it('should log pre-closed connections', async () => {
    const [conn, cleanup] = await createSocketConnection()

    logConnectionClosed(conn, true, 3000)

    expect(consoleMock).toHaveBeenLastCalledWith('--> WSS close')

    cleanup()
  })

  it('should log manually-closed connections', async () => {
    const [conn, cleanup] = await createSocketConnection()

    logConnectionClosed(conn, false, 3000, 'Unauthorised')

    expect(consoleMock).toHaveBeenLastCalledWith('<-- WSS close')

    cleanup()
  })

  it('should log manually-closed connections without a SocketConnection', async () => {
    logConnectionClosed(undefined, false, 3000)

    expect(consoleMock).toHaveBeenLastCalledWith('<-- WSS close')
  })
})
