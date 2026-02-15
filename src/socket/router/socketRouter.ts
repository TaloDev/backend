import { z, ZodError, ZodType } from 'zod'
import Socket from '..'
import { heartbeatMessage, requests } from '../messages/socketMessage'
import SocketConnection from '../socketConnection'
import { RawData } from 'ws'
import { addBreadcrumb } from '@sentry/node'
import { SocketMessageListener } from './createListener'
import SocketError, { sendError } from '../messages/socketError'
import { APIKeyScope } from '../../entities/api-key'
import playerListeners from '../listeners/playerListeners'
import gameChannelListeners from '../listeners/gameChannelListeners'
import playerRelationshipsListeners from '../listeners/playerRelationshipsListeners'
import { logRequest } from '../messages/socketLogger'
import { SpanStatusCode } from '@opentelemetry/api'
import { getSocketTracer } from '../socketTracer'

const socketMessageValidator = z.object({
  req: z.enum(requests),
  data: z.looseObject({})
})

type SocketMessage = z.infer<typeof socketMessageValidator>

const routes: SocketMessageListener<ZodType>[][] = [
  playerListeners,
  gameChannelListeners,
  playerRelationshipsListeners
]

export default class SocketRouter {
  constructor(readonly wss: Socket) { }

  async handleMessage(conn: SocketConnection, rawData: RawData): Promise<void> {
    await getSocketTracer().startActiveSpan('socket.message_received', async (span) => {
      const message = rawData.toString()

      logRequest(conn, message)

      const rateLimitExceeded = await conn.checkRateLimitExceeded(this.wss.redis)
      if (rateLimitExceeded) {
        if (conn.rateLimitWarnings > 3) {
          await this.wss.closeConnection(conn.getSocket(), { code: 1008, reason: 'RATE_LIMIT_EXCEEDED' })
        } else {
          await sendError(conn, 'unknown', new SocketError('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded'))
        }
        return
      }

      if (message === heartbeatMessage) {
        await conn.handleHeartbeat(true)
        return
      }

      let parsedMessage: SocketMessage | null = null

      try {
        parsedMessage = await socketMessageValidator.parseAsync(JSON.parse(message))

        addBreadcrumb({
          category: 'message',
          message: parsedMessage.req,
          level: 'info'
        })

        const handled = await this.routeMessage(conn, parsedMessage)
        if (!handled) {
          await sendError(conn, parsedMessage.req, new SocketError('UNHANDLED_REQUEST', 'Request not handled'))
          span.setStatus({ code: SpanStatusCode.ERROR })
        } else {
          span.setStatus({ code: SpanStatusCode.OK })
        }
      } catch (err) {
        if (err instanceof ZodError) {
          await sendError(conn, 'unknown', new SocketError('INVALID_MESSAGE', 'Invalid message request', message))
        } else {
          await sendError(conn, parsedMessage?.req ?? 'unknown', new SocketError('ROUTING_ERROR', 'An error occurred while routing the message'))
        }
        span.setStatus({ code: SpanStatusCode.ERROR })
      } finally {
        span.end()
      }
    })
  }

  async routeMessage(conn: SocketConnection, message: SocketMessage): Promise<boolean> {
    for (const route of routes) {
      for await (const listener of route) {
        if (listener.req === message.req) {
          try {
            if (!this.meetsPlayerRequirement(conn, listener)) {
              await sendError(conn, message.req, new SocketError('NO_PLAYER_FOUND', 'You must identify a player before sending this request'))
            } else if (!this.meetsScopeRequirements(conn, listener)) {
              const missing = this.getMissingScopes(conn, listener)
              await sendError(conn, message.req, new SocketError('MISSING_ACCESS_KEY_SCOPES', `Missing access key scope(s): ${missing.join(', ')}`))
            } else {
              const data = await listener.validator.parseAsync(message.data)
              await listener.handler({ conn, req: listener.req, data, socket: this.wss })
            }
            return true
          } catch (err) {
            if (err instanceof ZodError) {
              await sendError(conn, message.req, new SocketError('INVALID_MESSAGE_DATA', 'Invalid message data for request', JSON.stringify(message.data)))
            } else {
              await sendError(conn, message?.req ?? 'unknown', new SocketError('LISTENER_ERROR', 'An error occurred while processing the message', (err as Error).message))
            }
            return true
          }
        }
      }
    }

    return false
  }

  meetsPlayerRequirement(conn: SocketConnection, listener: SocketMessageListener<ZodType>): boolean {
    const requirePlayer = listener.options?.requirePlayer ?? true
    return Boolean(conn.playerAliasId) || !requirePlayer
  }

  meetsScopeRequirements(conn: SocketConnection, listener: SocketMessageListener<ZodType>): boolean {
    const requiredScopes = listener.options?.apiKeyScopes ?? []
    return conn.hasScopes(requiredScopes)
  }

  getMissingScopes(conn: SocketConnection, listener: SocketMessageListener<ZodType>): APIKeyScope[] {
    return (listener.options?.apiKeyScopes ?? []).filter((scope) => !conn.hasScope(scope))
  }
}
