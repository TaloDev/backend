import { IncomingMessage, Server } from 'http'
import { RawData, WebSocket, WebSocketServer } from 'ws'
import { captureException } from '@sentry/node'
import { EntityManager, RequestContext } from '@mikro-orm/mysql'
import authenticateSocket from './authenticateSocket'
import SocketConnection from './socketConnection'
import SocketRouter from './router/socketRouter'
import { sendMessage } from './messages/socketMessage'
import { logConnection, logConnectionClosed } from './messages/socketLogger'

type CloseConnectionOptions = {
  code?: number
  reason?: string
  terminate?: boolean
  preclosed?: boolean
}

export default class Socket {
  private readonly wss: WebSocketServer
  private connections: Map<WebSocket, SocketConnection> = new Map()
  private router: SocketRouter

  constructor(server: Server, private readonly em: EntityManager) {
    this.wss = new WebSocketServer({ server })
    this.wss.on('connection', async (ws, req) => {
      await this.handleConnection(ws, req)

      ws.on('message', (data) => this.handleMessage(ws, data))
      ws.on('pong', () => this.handlePong(ws))
      ws.on('close', () => this.closeConnection(ws, { preclosed: true }))
      ws.on('error', captureException)
    })

    this.router = new SocketRouter(this)

    this.heartbeat()
  }

  getServer(): WebSocketServer {
    return this.wss
  }

  /* v8 ignore start */
  heartbeat(): void {
    const interval = setInterval(() => {
      for (const [ws, conn] of this.connections.entries()) {
        if (!conn.alive) {
          this.closeConnection(ws, { terminate: true })
          continue
        }

        conn.alive = false
        ws.ping()
      }
    }, 30_000)

    this.wss.on('close', () => {
      clearInterval(interval)
    })
  }
  /* v8 ignore stop */

  async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    logConnection(req)

    await RequestContext.create(this.em, async () => {
      const key = await authenticateSocket(req.headers?.authorization ?? '')
      if (key) {
        const connection = new SocketConnection(ws, key, req)
        this.connections.set(ws, connection)
        sendMessage(connection, 'v1.connected', {})
      } else {
        this.closeConnection(ws)
      }
    })
  }

  async handleMessage(ws: WebSocket, data: RawData): Promise<void> {
    await RequestContext.create(this.em, async () => {
      const connection = this.connections.get(ws)
      if (connection) {
        await this.router.handleMessage(connection, data)
      /* v8 ignore next 3 */
      } else {
        this.closeConnection(ws)
      }
    })
  }

  /* v8 ignore start */
  handlePong(ws: WebSocket): void {
    const connection = this.findConnection(ws)
    if (!connection) return

    connection.alive = true
    if (connection.rateLimitWarnings > 0) {
      connection.rateLimitWarnings--
    }
  }
  /* v8 ignore stop */

  closeConnection(ws: WebSocket, options: CloseConnectionOptions = {}): void {
    const terminate = options.terminate ?? false
    const preclosed = options.preclosed ?? false
    const code = options.code ?? 3000

    /* v8 ignore next 2 */
    if (terminate) {
      ws.terminate()
    } else if (!preclosed) {
      ws.close(code, options.reason)
    }

    const connection = this.findConnection(ws)
    /* v8 ignore next */
    if (!connection) return

    logConnectionClosed(connection, preclosed, code, options.reason)

    this.connections.delete(ws)
  }

  findConnection(ws: WebSocket): SocketConnection | undefined {
    return this.connections.get(ws)
  }

  findConnections(filter: (conn: SocketConnection) => boolean): SocketConnection[] {
    return Array.from(this.connections.values()).filter(filter)
  }
}
