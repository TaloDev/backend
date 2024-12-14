import { IncomingMessage, Server } from 'http'
import { RawData, WebSocket, WebSocketServer } from 'ws'
import { captureException } from '@sentry/node'
import { EntityManager, RequestContext } from '@mikro-orm/mysql'
import authenticateSocket from './authenticateSocket'
import SocketConnection from './socketConnection'
import SocketRouter from './router/socketRouter'
import { sendMessage } from './messages/socketMessage'

type CloseConnectionOptions = {
  code?: number
  reason?: string
  terminate?: boolean
  preclosed?: boolean
}

export default class Socket {
  private readonly wss: WebSocketServer
  private connections: SocketConnection[] = []
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

  heartbeat(): void {
    const interval = setInterval(() => {
      this.connections.forEach((conn) => {
        /* v8 ignore start */
        if (!conn.alive) {
          this.closeConnection(conn.ws, { terminate: true })
          return
        }

        conn.alive = false
        conn.ws.ping()
        /* v8 ignore end */
      })
    }, 30_000)

    this.wss.on('close', () => {
      clearInterval(interval)
    })
  }

  async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    await RequestContext.create(this.em, async () => {
      const key = await authenticateSocket(req.headers?.authorization ?? '')
      if (key) {
        this.connections.push(new SocketConnection(ws, key, req))
        sendMessage(this.connections.at(-1), 'v1.connected', {})
      } else {
        this.closeConnection(ws)
      }
    })
  }

  async handleMessage(ws: WebSocket, data: RawData): Promise<void> {
    await RequestContext.create(this.em, async () => {
      await this.router.handleMessage(this.findConnectionBySocket(ws), data)
    })
  }

  /* v8 ignore start */
  handlePong(ws: WebSocket): void {
    const connection = this.findConnectionBySocket(ws)
    if (!connection) return

    connection.alive = true
    if (connection.rateLimitWarnings > 0) {
      connection.rateLimitWarnings--
    }
  }
  /* v8 ignore end */

  closeConnection(ws: WebSocket, options: CloseConnectionOptions = {}): void {
    const terminate = options.terminate ?? false
    const preclosed = options.preclosed ?? false

    if (terminate) {
      ws.terminate()
    } else if (!preclosed) {
      ws.close(options.code ?? 3000, options.reason)
    }

    this.connections = this.connections.filter((conn) => conn.ws !== ws)
  }

  findConnectionBySocket(ws: WebSocket): SocketConnection | undefined {
    const connection = this.connections.find((conn) => conn.ws === ws)
    /* v8 ignore start */
    if (!connection) {
      this.closeConnection(ws)
      return
    }
    /* v8 ignore end */

    return connection
  }

  findConnections(filter: (conn: SocketConnection) => boolean): SocketConnection[] {
    return this.connections.filter(filter)
  }
}
