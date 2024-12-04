import { captureException, setTag } from '@sentry/node'
import SocketConnection from './socketConnection'

export const requests = [
  'v1.players.identify'
] as const

export type SocketMessageRequest = typeof requests[number]

export const responses = [
  'v1.connected',
  'v1.error',
  'v1.players.identify.success',
  'v1.players.identify.error'
] as const

export type SocketMessageResponse = typeof responses[number]

export function sendMessage<T>(connection: SocketConnection, res: SocketMessageResponse, data: T) {
  connection.ws.send(JSON.stringify({
    res,
    data
  }))
}

export function sendMessages<T>(connections: SocketConnection[], type: SocketMessageResponse, data: T) {
  connections.forEach((ws) => sendMessage<T>(ws, type, data))
}

export function sendError(connection: SocketConnection, req: SocketMessageRequest | 'unknown', error: Error) {
  setTag('request', req)
  captureException(error)

  sendMessage(connection, 'v1.error', {
    req,
    message: error.message,
    cause: error.cause
  })
}
