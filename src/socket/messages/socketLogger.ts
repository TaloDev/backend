import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { IncomingMessage } from 'http'
import SocketConnection from '../socketConnection.js'
import { heartbeatMessage, SocketMessageResponse } from './socketMessage.js'

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
    const jsonStr =
      conn.verifyRequests && message.includes('\n')
        ? message.slice(message.indexOf('\n') + 1)
        : message
    req = JSON.parse(jsonStr).req ?? 'unknown'
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

const silentResponses: SocketMessageResponse[] = ['v1.connected']

export function logResponse(conn: SocketConnection, res: SocketMessageResponse, message: string) {
  if (!canLog()) {
    return
  }

  setTraceAttributes({
    'socket.ip': conn.getRemoteAddress(),
    'socket.message.res': res,
    'socket.message.size': getSize(message),
  })

  if (silentResponses.includes(res)) {
    return
  }

  console.info(`<-- WSS ${res}`)
}

export function traceConnection(req: IncomingMessage) {
  if (!canLog()) {
    return
  }

  setTraceAttributes({
    'socket.ip': req.socket.remoteAddress,
  })
}
