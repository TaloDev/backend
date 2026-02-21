import { EntityManager, RequestContext } from '@mikro-orm/mysql'
import { captureException, withIsolationScope } from '@sentry/node'
import { IncomingMessage, Server } from 'http'
import Redis from 'ioredis'
import { RawData, WebSocket, WebSocketServer } from 'ws'
import { createRedisConnection } from '../config/redis.config'
import { enableSocketTracing } from './enableSocketTracing'
import { logConnection, logConnectionClosed } from './messages/socketLogger'
import { sendMessage } from './messages/socketMessage'
import SocketRouter from './router/socketRouter'
import SocketConnection from './socketConnection'
import SocketTicket from './socketTicket'
import { getSocketTracer } from './socketTracer'

type CloseConnectionOptions = {
  code?: number
  reason?: string
  terminate?: boolean
  preclosed?: boolean
}

export default class Socket {
  private readonly wss: WebSocketServer
  private connections: Map<WebSocket, SocketConnection> = new Map()
  private pendingCloseOperations: Set<Promise<void>> = new Set()
  private router: SocketRouter
  redis: Redis

  constructor(
    server: Server,
    private readonly em: EntityManager,
  ) {
    this.wss = new WebSocketServer({ server })
    this.wss.on('connection', async (ws, req) => {
      await this.handleConnection(ws, req)

      ws.on('message', (data) => this.handleMessage(ws, data))
      ws.on('pong', () => this.handlePong(ws))
      ws.on('close', () => this.closeConnection(ws, { preclosed: true }))
      ws.on('error', captureException)
    })

    this.router = new SocketRouter(this)

    const interval = this.heartbeat()
    this.wss.on('close', () => {
      clearInterval(interval)
    })

    this.redis = createRedisConnection()

    enableSocketTracing(this)
  }

  getServer() {
    return this.wss
  }

  /* v8 ignore start */
  heartbeat() {
    return setInterval(async () => {
      for (const [ws, conn] of this.connections.entries()) {
        if (!conn.alive) {
          await this.closeConnection(ws, { terminate: true })
          continue
        }

        conn.ping()
      }
    }, 30_000)
  }
  /* v8 ignore stop */

  async handleConnection(ws: WebSocket, req: IncomingMessage) {
    await withIsolationScope(async () => {
      await getSocketTracer().startActiveSpan('socket.open', async (span) => {
        try {
          logConnection(req)

          await RequestContext.create(this.em, async () => {
            const url = new URL(req.url!, 'http://localhost')
            const ticket = new SocketTicket(url.searchParams.get('ticket') ?? '')

            if (await ticket.validate(this.redis)) {
              const connection = new SocketConnection(this, ws, ticket, req.socket.remoteAddress!)
              this.connections.set(ws, connection)

              await sendMessage(connection, 'v1.connected', {})
            } else {
              await this.closeConnection(ws)
            }
          })
        } finally {
          span.end()
        }
      })
    })
  }

  async handleMessage(ws: WebSocket, data: RawData) {
    await withIsolationScope(async () => {
      await getSocketTracer().startActiveSpan('socket.message', async (span) => {
        try {
          await RequestContext.create(this.em, async () => {
            const connection = this.connections.get(ws)
            if (connection) {
              await this.router.handleMessage(connection, data)
              /* v8 ignore next 3 */
            } else {
              await this.closeConnection(ws)
            }
          })
        } finally {
          span.end()
        }
      })
    })
  }

  /* v8 ignore start */
  handlePong(ws: WebSocket) {
    const connection = this.findConnection(ws)
    if (!connection) return
    connection.handleHeartbeat()
  }
  /* v8 ignore stop */

  async closeConnection(ws: WebSocket, options: CloseConnectionOptions = {}) {
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

    // delete before async work to prevent duplicate handleClosed calls
    this.connections.delete(ws)

    const closeOperation = this.createCloseOperation({
      connection,
      preclosed,
      code,
      reason: options.reason,
    })
    this.pendingCloseOperations.add(closeOperation)
    try {
      await closeOperation
    } finally {
      this.pendingCloseOperations.delete(closeOperation)
    }
  }

  private async createCloseOperation({
    connection,
    preclosed,
    code,
    reason,
  }: {
    connection: SocketConnection
    preclosed: boolean
    code: number
    reason?: string
  }) {
    await RequestContext.create(this.em, async () => {
      await connection.handleClosed()
    })
    logConnectionClosed(connection, preclosed, code, reason)
  }

  async waitForPendingOperations() {
    await Promise.all(this.pendingCloseOperations)
  }

  findConnection(ws: WebSocket) {
    return this.connections.get(ws)
  }

  findConnections(filter: (conn: SocketConnection) => boolean) {
    return Array.from(this.connections.values()).filter(filter)
  }
}
