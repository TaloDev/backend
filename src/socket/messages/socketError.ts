import { captureException, setTag } from '@sentry/node'
import { sendMessage, SocketMessageRequest } from './socketMessage'
import SocketConnection from '../socketConnection'

const errorCodes = [
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
] as const

export type SocketErrorCode = typeof errorCodes[number]

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

export async function sendError(conn: SocketConnection, req: SocketErrorReq, error: SocketError) {
  if (validSentryErrorCodes.includes(error.code)) {
    setTag('request', req)
    setTag('errorCode', error.code)
    captureException(new Error(error.message, { cause: error }))
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
