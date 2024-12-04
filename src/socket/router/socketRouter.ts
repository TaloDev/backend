import { z, ZodError, ZodType } from 'zod'
import Socket from '..'
import { SocketMessageRequest, requests, sendError } from '../socketMessage'
import SocketConnection from '../socketConnection'
import { RawData } from 'ws'
import { addBreadcrumb } from '@sentry/node'
import routes, { SocketMessageListener, SocketMessageListenerHandler } from './socketRoutes'
import { pick } from 'lodash'

export function createListener<T extends ZodType>(
  req: SocketMessageRequest,
  validator: T,
  handler: SocketMessageListenerHandler<z.infer<T>>,
  requirePlayer = true
): SocketMessageListener<T> {
  return {
    req,
    validator,
    handler,
    requirePlayer
  }
}

const socketMessageValidator = z.object({
  req: z.enum(requests),
  data: z.object({}).passthrough()
})

type SocketMessage = z.infer<typeof socketMessageValidator>

export default class SocketRouter {
  constructor(readonly socket: Socket) {}

  async handleMessage(conn: SocketConnection, rawData: RawData): Promise<void> {
    addBreadcrumb({
      category: 'message',
      message: rawData.toString(),
      level: 'info'
    })

    let message: SocketMessage = null

    try {
      message = await this.getParsedMessage(rawData)

      const handled = await this.routeMessage(conn, message)
      if (!handled) {
        sendError(conn, message.req, new Error('Unhandled request'))
      }
    } catch (err) {
      if (err instanceof ZodError) {
        sendError(conn, 'unknown', new Error('Invalid message', { cause: this.sanitiseZodError(err) }))
      } else {
        sendError(conn, message.req, new Error('Routing error', { cause: err }))
      }
    }
  }

  async getParsedMessage(rawData: RawData): Promise<SocketMessage> {
    return await socketMessageValidator.parseAsync(JSON.parse(rawData.toString()))
  }

  async routeMessage(conn: SocketConnection, message: SocketMessage): Promise<boolean> {
    let handled = false

    for (const route of routes) {
      for await (const listener of route) {
        if (listener.req === message.req) {
          try {
            handled = true

            if (listener.requirePlayer && !conn.playerAlias) {
              sendError(conn, message.req, new Error('No player found'))
            } else {
              const data = await listener.validator.parseAsync(message.data)
              listener.handler(conn, data, this.socket)
            }

            break
          } catch (err) {
            if (err instanceof ZodError) {
              sendError(conn, message.req, new Error('Invalid message data', { cause: this.sanitiseZodError(err) }))
            } else {
              sendError(conn, message.req, new Error('Listener error', { cause: err }))
            }
          }
        }
      }
    }

    return handled
  }

  sanitiseZodError(err: ZodError) {
    return {
      issues: err.issues.map((issue) => {
        return pick(issue, ['received', 'code', 'options', 'path'])
      })
    }
  }
}
