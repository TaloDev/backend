import { captureException, setTag } from '@sentry/node'
import { sendMessage, SocketMessageRequest } from './socketMessage'
import SocketConnection from '../socketConnection'

const codes = [
  'INVALID_MESSAGE',
  'INVALID_MESSAGE_DATA',
  'NO_PLAYER_FOUND',
  'UNHANDLED_REQUEST',
  'ROUTING_ERROR',
  'LISTENER_ERROR',
  'INVALID_SOCKET_TOKEN',
  'MISSING_ACCESS_KEY_SCOPE'
] as const

export type SocketErrorCode = typeof codes[number]

export default class SocketError {
  constructor(public code: SocketErrorCode, public message: string) {}
}

type SocketErrorReq = SocketMessageRequest | 'unknown'

export function sendError(conn: SocketConnection, req: SocketErrorReq, error: SocketError) {
  setTag('request', req)
  setTag('errorCode', error.code)
  captureException(error)

  sendMessage<{
    req: SocketErrorReq
    message: string
    errorCode: SocketErrorCode
  }>(conn, 'v1.error', {
    req,
    message: error.message,
    errorCode: error.code
  })
}
