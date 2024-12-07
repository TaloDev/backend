import { IncomingMessage, Server } from 'http'
import { RawData, WebSocket, WebSocketServer } from 'ws'
import { captureException } from '@sentry/node'
import { EntityManager, RequestContext } from '@mikro-orm/mysql'
import authenticateSocket from './authenticateSocket'
import SocketConnection from './socketConnection'
import SocketRouter from './router/socketRouter'
import { sendMessage } from './messages/socketMessage'

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
      ws.on('close', () => this.handleClose(ws))
      ws.on('error', captureException)
    })

    this.router = new SocketRouter(this)

    this.heartbeat()
  }

  heartbeat(): void {
    const interval = setInterval(() => {
      this.connections.forEach((conn) => {
        if (!conn.alive) {
          conn.ws.terminate()
          return
        }

        conn.alive = false
        conn.ws.ping()
      })
    }, 30_000)

    this.wss.on('close', () => {
      clearInterval(interval)
    })
  }

  async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    await RequestContext.create(this.em, async () => {
      const key = await authenticateSocket(req.headers?.authorization ?? '', ws)
      this.connections.push(new SocketConnection(ws, key))
      sendMessage(this.connections.at(-1), 'v1.connected', {})
    })
  }

  async handleMessage(ws: WebSocket, data: RawData): Promise<void> {
    await RequestContext.create(this.em, async () => {
      await this.router.handleMessage(this.findConnectionBySocket(ws), data)
    })
  }

  handlePong(ws: WebSocket): void {
    const connection = this.findConnectionBySocket(ws)
    if (!connection) return

    connection.alive = true
  }

  handleClose(ws: WebSocket): void {
    this.connections = this.connections.filter((conn) => conn.ws !== ws)
  }

  findConnectionBySocket(ws: WebSocket): SocketConnection | undefined {
    const connection = this.connections.find((conn) => conn.ws === ws)
    if (!connection) {
      ws.close(3000)
      return
    }

    return connection
  }

  findConnections(filter: (conn: SocketConnection) => boolean): SocketConnection[] {
    return this.connections.filter(filter)
  }
}
