import { IncomingMessage, Server } from 'http'
import { RawData, WebSocket, WebSocketServer } from 'ws'
import { captureException, withIsolationScope } from '@sentry/node'
import { EntityManager, RequestContext } from '@mikro-orm/mysql'
import SocketConnection from './socketConnection'
import SocketRouter from './router/socketRouter'
import { sendMessage } from './messages/socketMessage'
import { logConnection, logConnectionClosed } from './messages/socketLogger'
import { SocketEventData } from './socketEvent'
import Redis from 'ioredis'
import redisConfig from '../config/redis.config'
import SocketTicket from './socketTicket'
import { getSocketTracer } from './socketTracer'
import { FlushSocketEventsQueueHandler } from '../lib/queues/game-metrics/flush-socket-events-queue-handler'
import { v4 } from 'uuid'

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
  private queueHandler: FlushSocketEventsQueueHandler

  constructor(server: Server, private readonly em: EntityManager) {
    this.wss = new WebSocketServer({ server })
    this.wss.on('connection', async (ws, req) => {
      await getSocketTracer().startActiveSpan('socket.event_handler', async (span) => {
        await this.handleConnection(ws, req)

        ws.on('message', (data) => this.handleMessage(ws, data))
        ws.on('pong', () => this.handlePong(ws))
        ws.on('close', () => this.closeConnection(ws, { preclosed: true }))
        ws.on('error', captureException)
        span.end()
      })
    })

    this.router = new SocketRouter(this)

    this.queueHandler = new FlushSocketEventsQueueHandler()

    const interval = this.heartbeat()
    this.wss.on('close', () => {
      clearInterval(interval)
    })
  }

  getServer(): WebSocketServer {
    return this.wss
  }

  /* v8 ignore start */
  heartbeat(): NodeJS.Timeout {
    return setInterval(async () => {
      for (const [ws, conn] of this.connections.entries()) {
        if (!conn.alive) {
          await this.closeConnection(ws, { terminate: true })
          continue
        }

        conn.alive = false
        ws.ping()
      }
    }, 30_000)
  }
  /* v8 ignore stop */

  async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    withIsolationScope(async () => {
      await getSocketTracer().startActiveSpan('socket.open', async (span) => {
        logConnection(req)

        const redis = new Redis(redisConfig)

        await RequestContext.create(this.em, async () => {
          const url = new URL(req.url!, 'http://localhost')
          const ticket = new SocketTicket(url.searchParams.get('ticket') ?? '')

          if (await ticket.validate(redis)) {
            const connection = new SocketConnection(this, ws, ticket, req.socket.remoteAddress!)
            this.connections.set(ws, connection)

            await this.trackEvent({
              eventType: 'open',
              reqOrRes: 'req',
              code: null,
              gameId: connection.game.id,
              playerAliasId: null,
              devBuild: ticket.devBuild
            })

            await sendMessage(connection, 'v1.connected', {})
          } else {
            await this.closeConnection(ws)
          }
        })

        await redis.quit()

        span.end()
      })
    })
  }

  async handleMessage(ws: WebSocket, data: RawData): Promise<void> {
    withIsolationScope(async () => {
      await getSocketTracer().startActiveSpan('socket.message', async (span) => {
        await RequestContext.create(this.em, async () => {
          const connection = this.connections.get(ws)
          if (connection) {
            await this.router.handleMessage(connection, data)
          /* v8 ignore next 3 */
          } else {
            await this.closeConnection(ws)
          }
        })

        span.end()
      })
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

  async closeConnection(ws: WebSocket, options: CloseConnectionOptions = {}): Promise<void> {
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

    await RequestContext.create(this.em, async () => {
      await connection.handleClosed()
    })

    logConnectionClosed(connection, preclosed, code, options.reason)

    await this.trackEvent({
      eventType: 'close',
      reqOrRes: preclosed ? 'req' : 'res',
      code: preclosed ? null : code.toString(),
      gameId: connection.game.id,
      playerAliasId: connection.playerAliasId,
      devBuild: connection.isDevBuild()
    })

    this.connections.delete(ws)
  }

  findConnection(ws: WebSocket): SocketConnection | undefined {
    return this.connections.get(ws)
  }

  findConnections(filter: (conn: SocketConnection) => boolean): SocketConnection[] {
    return Array.from(this.connections.values()).filter(filter)
  }

  async findConnectionsAsync(filter: (conn: SocketConnection) => Promise<boolean>): Promise<SocketConnection[]> {
    const connections = Array.from(this.connections.values())
    const results = await Promise.all(
      connections.map(async (conn) => ({
        conn,
        matches: await filter(conn)
      }))
    )
    return results.filter((r) => r.matches).map((r) => r.conn)
  }

  async trackEvent(data: Omit<SocketEventData, 'id'>): Promise<void> {
    if (process.env.DISABLE_SOCKET_EVENTS === '1') {
      return
    }

    /* v8 ignore next - tests mock this implementation */
    await this.queueHandler.add({ id: v4(), ...data })
  }
}
