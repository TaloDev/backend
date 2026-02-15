import * as Sentry from '@sentry/node'
import { sendMessage, SocketMessageRequest } from './socketMessage'
import SocketConnection from '../socketConnection'

export type SocketErrorCode = [
  'INVALID_MESSAGE',
  'INVALID_MESSAGE_DATA',
  'NO_PLAYER_FOUND',
  'UNHANDLED_REQUEST',
  'ROUTING_ERROR',
  'LISTENER_ERROR',
  'INVALID_SOCKET_TOKEN',
  'INVALID_SESSION_TOKEN',
  'MISSING_ACCESS_KEY_SCOPES',
  'RATE_LIMIT_EXCEEDED'
][number]

const validSentryErrorCodes: SocketErrorCode[] = [
  'UNHANDLED_REQUEST',
  'ROUTING_ERROR',
  'LISTENER_ERROR',
  'RATE_LIMIT_EXCEEDED'
]

export default class SocketError {
  constructor(public code: SocketErrorCode, public message: string, public cause?: string) { }
}

type SocketErrorReq = SocketMessageRequest | 'unknown'

export async function sendError({
  conn,
  req,
  error,
  originalError
}: {
  conn: SocketConnection
  req: SocketErrorReq
  error: SocketError
  originalError?: Error
}) {
  if (validSentryErrorCodes.includes(error.code)) {
    Sentry.withScope((scope) => {
      scope.setTag('request', req)
      scope.setTag('errorCode', error.code)
      if (error.cause) {
        scope.setContext('socketError', { cause: error.cause })
      }
      Sentry.captureException(originalError ?? new Error(error.message))
    })
  }

  await sendMessage<{
    req: SocketErrorReq
    message: string
    errorCode: SocketErrorCode
    cause?: string
  }>(conn, 'v1.error', {
    req,
    message: error.message,
    errorCode: error.code,
    cause: error.cause
  })
}
