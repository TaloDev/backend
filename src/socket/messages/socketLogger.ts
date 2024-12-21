import SocketConnection from '../socketConnection'
import { SocketMessageResponse } from './socketMessage'
import { IncomingMessage } from 'http'

function canLog(): boolean {
  return process.env.NODE_ENV !== 'test'
}

function getSocketUrl(conn: SocketConnection | undefined): string {
  if (!conn) {
    return 'WSS /'
  }
  return `WSS /games/${conn.game.id}/${conn.playerAliasId ? `aliases/${conn.playerAliasId}/` : ''}`
}

function getSize(message: string): string {
  return `${Buffer.byteLength(message)}b`
}

export function logRequest(conn: SocketConnection, message: string) {
  if (!canLog()) {
    return
  }

  const req = JSON.parse(message)?.req
  console.log(`  <-- ${getSocketUrl(conn)}{${req}} ${conn.getRemoteAddress()} ${getSize(message)}`)
}

export function logResponse(conn: SocketConnection, res: SocketMessageResponse, message: string) {
  if (!canLog()) {
    return
  }

  console.log(`  --> ${getSocketUrl(conn)}{${res}} ${conn.getRemoteAddress()} ${getSize(message)}`)
}

export function logConnection(req: IncomingMessage) {
  if (!canLog()) {
    return
  }

  console.log(`  <-- WSS /open ${req.socket.remoteAddress}`)
}

export function logConnectionClosed(conn: SocketConnection | undefined, preclosed: boolean, code: number, reason?: string) {
  if (!canLog()) {
    return
  }

  const direction = preclosed ? '<--' : '-->'
  const ip = conn?.getRemoteAddress() ?? 'unknown'
  const displayCode = preclosed ? '' : code
  const displayReason = reason ?? ''
  console.log(`  ${direction} ${getSocketUrl(conn)}close ${ip} ${displayCode} ${displayReason}`.trimEnd())
}
