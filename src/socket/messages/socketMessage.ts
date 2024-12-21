import SocketConnection from '../socketConnection'
import { logResponse } from './socketLogger'

export const requests = [
  'v1.players.identify',
  'v1.channels.message'
] as const

export type SocketMessageRequest = typeof requests[number]

export const responses = [
  'v1.connected',
  'v1.error',
  'v1.players.identify.success',
  'v1.channels.player-joined',
  'v1.channels.player-left',
  'v1.channels.message',
  'v1.channels.deleted',
  'v1.channels.ownership-transferred'
] as const

export type SocketMessageResponse = typeof responses[number]

export function sendMessage<T>(conn: SocketConnection, res: SocketMessageResponse, data: T) {
  if (conn.ws.readyState === conn.ws.OPEN) {
    const message = JSON.stringify({
      res,
      data
    })

    logResponse(conn, res, message)

    conn.ws.send(message)
  }
}

export function sendMessages<T>(conns: SocketConnection[], type: SocketMessageResponse, data: T) {
  conns.forEach((conn) => {
    if (conn.ws.readyState === conn.ws.OPEN) {
      sendMessage<T>(conn, type, data)
    }
  })
}
