import { z, ZodError, ZodType } from 'zod'
import Socket from '..'
import { requests } from '../messages/socketMessage'
import SocketConnection from '../socketConnection'
import { RawData } from 'ws'
import { addBreadcrumb } from '@sentry/node'
import { SocketMessageListener } from './createListener'
import SocketError, { sendError } from '../messages/socketError'
import { APIKeyScope } from '../../entities/api-key'
import playerListeners from '../listeners/playerListeners'
import gameChannelListeners from '../listeners/gameChannelListeners'
import { logRequest } from '../messages/socketLogger'

const socketMessageValidator = z.object({
  req: z.enum(requests),
  data: z.object({}).passthrough()
})

type SocketMessage = z.infer<typeof socketMessageValidator>

const routes: SocketMessageListener<ZodType>[][] = [
  playerListeners,
  gameChannelListeners
]

export default class SocketRouter {
  constructor(readonly socket: Socket) {}

  async handleMessage(conn: SocketConnection, rawData: RawData): Promise<void> {
    logRequest(conn, rawData)

    addBreadcrumb({
      category: 'message',
      message: rawData.toString(),
      level: 'info'
    })

    const rateLimitExceeded = await conn.checkRateLimitExceeded()
    if (rateLimitExceeded) {
      if (conn.rateLimitWarnings > 3) {
        this.socket.closeConnection(conn.ws, { code: 1008, reason: 'RATE_LIMIT_EXCEEDED' })
      } else {
        sendError(conn, 'unknown', new SocketError('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded'))
      }
      return
    }

    let message: SocketMessage = null

    try {
      message = await socketMessageValidator.parseAsync(JSON.parse(rawData.toString()))

      const handled = await this.routeMessage(conn, message)
      if (!handled) {
        sendError(conn, message.req, new SocketError('UNHANDLED_REQUEST', 'Request not handled'))
      }
    } catch (err) {
      if (err instanceof ZodError) {
        sendError(conn, 'unknown', new SocketError('INVALID_MESSAGE', 'Invalid message request', rawData.toString()))
      } else {
        sendError(conn, message?.req ?? 'unknown', new SocketError('ROUTING_ERROR', 'An error occurred while routing the message'))
      }
    }
  }

  async routeMessage(conn: SocketConnection, message: SocketMessage): Promise<boolean> {
    for (const route of routes) {
      for await (const listener of route) {
        if (listener.req === message.req) {
          try {
            if (!this.meetsPlayerRequirement(conn, listener)) {
              sendError(conn, message.req, new SocketError('NO_PLAYER_FOUND', 'You must identify a player before sending this request'))
            } else if (!this.meetsScopeRequirements(conn, listener)) {
              const missing = this.getMissingScopes(conn, listener)
              sendError(conn, message.req, new SocketError('MISSING_ACCESS_KEY_SCOPES', `Missing access key scope(s): ${missing.join(', ')}`))
            } else {
              const data = await listener.validator.parseAsync(message.data)
              await listener.handler({ conn, req: listener.req, data, socket: this.socket })
            }

            return true
          } catch (err) {
            if (err instanceof ZodError) {
              sendError(conn, message.req, new SocketError('INVALID_MESSAGE_DATA', 'Invalid message data for request', JSON.stringify(message.data)))
            } else {
              sendError(conn, message?.req ?? 'unknown', new SocketError('LISTENER_ERROR', 'An error occurred while processing the message', err.message))
            }
          }
        }
      }
    }

    return false
  }

  meetsPlayerRequirement(conn: SocketConnection, listener: SocketMessageListener<ZodType>): boolean {
    const requirePlayer = listener.options.requirePlayer ?? true
    return Boolean(conn.playerAliasId) || !requirePlayer
  }

  meetsScopeRequirements(conn: SocketConnection, listener: SocketMessageListener<ZodType>): boolean {
    const requiredScopes = listener.options.apiKeyScopes ?? []
    return conn.hasScopes(requiredScopes)
  }

  getMissingScopes(conn: SocketConnection, listener: SocketMessageListener<ZodType>): APIKeyScope[] {
    return (listener.options.apiKeyScopes ?? []).filter((scope) => !conn.scopes.includes(scope))
  }
}
