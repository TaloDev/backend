import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { IncomingMessage } from 'http'
import SocketConnection from '../socketConnection'
import { heartbeatMessage, SocketMessageResponse } from './socketMessage'

function canLog(): boolean {
  return process.env.NODE_ENV !== 'test'
}

function getSize(message: string): string {
  return Buffer.byteLength(message).toString()
}

export function logRequest(conn: SocketConnection, message: string) {
  if (!canLog() || message === heartbeatMessage) {
    return
  }

  let req = ''
  try {
    req = JSON.parse(message).req ?? 'unknown'
  } catch {
    req = 'unknown'
  } finally {
    setTraceAttributes({
      'socket.ip': conn.getRemoteAddress(),
      'socket.message.req': req,
      'socket.message.size': getSize(message),
    })

    console.info(`--> WSS ${req}`)
  }
}

export function logResponse(conn: SocketConnection, res: SocketMessageResponse, message: string) {
  if (!canLog()) {
    return
  }

  setTraceAttributes({
    'socket.ip': conn.getRemoteAddress(),
    'socket.message.res': res,
    'socket.message.size': getSize(message),
  })

  console.info(`<-- WSS ${res}`)
}

export function logConnection(req: IncomingMessage) {
  if (!canLog()) {
    return
  }

  setTraceAttributes({
    'socket.ip': req.socket.remoteAddress,
  })

  console.info('--> WSS open')
}

export function logConnectionClosed(
  conn: SocketConnection | undefined,
  preclosed: boolean,
  code: number = -1,
  reason?: string,
) {
  if (!canLog()) {
    return
  }

  setTraceAttributes({
    'socket.ip': conn?.getRemoteAddress() ?? 'unknown',
    'socket.pre_closed': preclosed ? 'true' : 'false',
    'socket.close_code': code,
    'socket.close_reason': reason,
  })

  const direction = preclosed ? '-->' : '<--'
  console.info(`${direction} WSS close`)
}
