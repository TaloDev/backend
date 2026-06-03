import { EntityManager, RequestContext } from '@mikro-orm/mysql'
import { SpanStatusCode } from '@opentelemetry/api'
import { addBreadcrumb } from '@sentry/node'
import { RawData } from 'ws'
import { z, ZodError, ZodType } from 'zod'
import { APIKeyScope } from '../../entities/api-key.js'
import Game from '../../entities/game.js'
import { verifySignature } from '../../lib/auth/verify-signature.js'
import Socket from '../index.js'
import gameChannelListeners from '../listeners/gameChannelListeners.js'
import playerListeners from '../listeners/playerListeners.js'
import playerRelationshipsListeners from '../listeners/playerRelationshipsListeners.js'
import SocketError, { sendError } from '../messages/socketError.js'
import { logRequest } from '../messages/socketLogger.js'
import { heartbeatMessage, requests } from '../messages/socketMessage.js'
import SocketConnection from '../socketConnection.js'
import { getSocketTracer } from '../socketTracer.js'
import { SocketMessageListener } from './createListener.js'

const socketMessageValidator = z.object({
  req: z.enum(requests),
  data: z.looseObject({}),
})

type SocketMessage = z.infer<typeof socketMessageValidator>

const routes: SocketMessageListener<ZodType>[][] = [
  playerListeners,
  gameChannelListeners,
  playerRelationshipsListeners,
]

export default class SocketRouter {
  constructor(readonly wss: Socket) {}

  async handleMessage({
    conn,
    rawData,
    em,
  }: {
    conn: SocketConnection
    rawData: RawData
    em: EntityManager
  }) {
    await getSocketTracer().startActiveSpan('socket.message_received', async (span) => {
      const message = rawData.toString()

      logRequest(conn, message)

      const rateLimitExceeded = await conn.checkRateLimitExceeded(this.wss.redis)
      if (rateLimitExceeded) {
        if (conn.rateLimitWarnings > 3) {
          await this.wss.closeConnection(conn.getSocket(), {
            code: 1008,
            reason: 'RATE_LIMIT_EXCEEDED',
          })
        } else {
          sendError({
            conn,
            req: 'unknown',
            error: new SocketError('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded'),
          })
        }
        return
      }

      if (message === heartbeatMessage) {
        conn.handleHeartbeat(true)
        return
      }

      let parsedMessage: SocketMessage | null = null

      try {
        let signature: string | undefined
        let jsonString = message

        if (conn.verifyRequests) {
          const newlineIndex = message.indexOf('\n')
          if (newlineIndex !== -1) {
            signature = message.slice(0, newlineIndex)
            jsonString = message.slice(newlineIndex + 1)
          }
        }

        parsedMessage = socketMessageValidator.parse(JSON.parse(jsonString))

        addBreadcrumb({
          category: 'message',
          message: parsedMessage.req,
          level: 'info',
        })

        const handled = await this.routeMessage({
          conn,
          message: parsedMessage,
          em,
          signature,
          rawPayload: jsonString,
        })
        if (!handled) {
          sendError({
            conn,
            req: parsedMessage.req,
            error: new SocketError('UNHANDLED_REQUEST', 'Request not handled'),
          })
          span.setStatus({ code: SpanStatusCode.ERROR })
        } else {
          span.setStatus({ code: SpanStatusCode.OK })
        }
      } catch (err) {
        if (err instanceof ZodError) {
          sendError({
            conn,
            req: 'unknown',
            error: new SocketError('INVALID_MESSAGE', 'Invalid message request', message),
          })
        } else {
          const originalError = err as Error
          sendError({
            conn,
            req: parsedMessage?.req ?? 'unknown',
            error: new SocketError('ROUTING_ERROR', 'An error occurred while routing the message'),
            originalError,
          })
        }
        span.setStatus({ code: SpanStatusCode.ERROR })
      } finally {
        span.end()
      }
    })
  }

  async routeMessage({
    conn,
    message,
    em,
    signature,
    rawPayload,
  }: {
    conn: SocketConnection
    message: SocketMessage
    em: EntityManager
    signature?: string
    rawPayload: string
  }) {
    const valid = await this.verifySocketSignature({ conn, signature, rawPayload, em })
    if (!valid) {
      sendError({
        conn,
        req: message.req,
        error: new SocketError('INVALID_SIGNATURE', 'Invalid signature'),
      })
      return true
    }

    for (const route of routes) {
      for (const listener of route) {
        if (listener.req === message.req) {
          try {
            if (!this.meetsPlayerRequirement(conn, listener)) {
              sendError({
                conn,
                req: message.req,
                error: new SocketError(
                  'NO_PLAYER_FOUND',
                  'You must identify a player before sending this request',
                ),
              })
            } else if (!this.meetsScopeRequirements(conn, listener)) {
              const missing = this.getMissingScopes(conn, listener)
              sendError({
                conn,
                req: message.req,
                error: new SocketError(
                  'MISSING_ACCESS_KEY_SCOPES',
                  `Missing access key scope(s): ${missing.join(', ')}`,
                ),
              })
            } else {
              const data = await listener.validator.parseAsync(message.data)
              await RequestContext.create(em, async () => {
                await listener.handler({ conn, req: listener.req, data, socket: this.wss })
              })
            }
            return true
          } catch (err) {
            if (err instanceof ZodError) {
              sendError({
                conn,
                req: message.req,
                error: new SocketError(
                  'INVALID_MESSAGE_DATA',
                  'Invalid message data for request',
                  JSON.stringify(message.data),
                ),
              })
            } else {
              const originalError = err as Error
              sendError({
                conn,
                req: message?.req ?? 'unknown',
                error: new SocketError(
                  'LISTENER_ERROR',
                  'An error occurred while processing the message',
                  originalError.message,
                ),
                originalError,
              })
            }
            return true
          }
        }
      }
    }

    return false
  }

  meetsPlayerRequirement(
    conn: SocketConnection,
    listener: SocketMessageListener<ZodType>,
  ): boolean {
    const requirePlayer = listener.options?.requirePlayer ?? true
    return Boolean(conn.playerAliasId) || !requirePlayer
  }

  meetsScopeRequirements(
    conn: SocketConnection,
    listener: SocketMessageListener<ZodType>,
  ): boolean {
    const requiredScopes = listener.options?.apiKeyScopes ?? []
    return conn.hasScopes(requiredScopes)
  }

  private async verifySocketSignature({
    conn,
    signature,
    rawPayload,
    em,
  }: {
    conn: SocketConnection
    signature?: string
    rawPayload: string
    em: EntityManager
  }) {
    if (!conn.verifyRequests) {
      return true
    }

    if (!conn.playerAliasId) {
      return true
    }

    if (!signature) {
      return false
    }

    const game = await em.repo(Game).findOneOrFail(conn.gameId)

    return verifySignature({
      signature,
      rawPayload,
      game,
      aliasId: conn.playerAliasId,
      em,
      redis: this.wss.redis,
    })
  }

  getMissingScopes(
    conn: SocketConnection,
    listener: SocketMessageListener<ZodType>,
  ): APIKeyScope[] {
    return (listener.options?.apiKeyScopes ?? []).filter((scope) => !conn.hasScope(scope))
  }
}
