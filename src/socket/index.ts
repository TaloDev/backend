import { IncomingMessage, Server } from 'http'
import { RawData, WebSocket, WebSocketServer } from 'ws'
import { captureException } from '@sentry/node'
import { EntityManager, RequestContext } from '@mikro-orm/mysql'
import authenticateSocket from './authenticateSocket'
import SocketConnection from './socketConnection'
import SocketRouter from './router/socketRouter'
import { sendMessage } from './messages/socketMessage'
import { logConnection, logConnectionClosed } from './messages/socketLogger'
import { Queue } from 'bullmq'
import { createSocketEventQueue, SocketEventData } from './socketEvent'
import { ClickHouseClient } from '@clickhouse/client'
import createClickhouseClient from '../lib/clickhouse/createClient'

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
  private clickhouse: ClickHouseClient
  private eventQueue: Queue<SocketEventData>

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

    this.clickhouse = createClickhouseClient()
    this.eventQueue = createSocketEventQueue(this.clickhouse)

    const interval = this.heartbeat()

    this.wss.on('close', async () => {
      clearInterval(interval)
      await this.clickhouse.close()
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
    logConnection(req)

    await RequestContext.create(this.em, async () => {
      const key = await authenticateSocket(req.headers?.authorization ?? '')
      if (key) {
        const connection = new SocketConnection(this, ws, key, req)
        this.connections.set(ws, connection)

        await this.trackEvent('open', {
          eventType: 'open',
          reqOrRes: 'req',
          code: null,
          gameId: connection.game.id,
          playerAliasId: null,
          devBuild: req.headers['x-talo-dev-build'] === '1'
        })

        await sendMessage(connection, 'v1.connected', {})
      } else {
        await this.closeConnection(ws)
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
        await this.closeConnection(ws)
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

    logConnectionClosed(connection, preclosed, code, options.reason)

    await this.trackEvent('close', {
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

  async trackEvent(name: 'open' | 'close' | 'message', data: SocketEventData): Promise<void> {
    if (process.env.DISABLE_SOCKET_EVENTS === '1') {
      return
    }

    await this.eventQueue.add(name, data)
  }
}
