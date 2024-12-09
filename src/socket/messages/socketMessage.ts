import SocketConnection from '../socketConnection'

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
  'v1.channels.message'
] as const

export type SocketMessageResponse = typeof responses[number]

export function sendMessage<T>(conn: SocketConnection, res: SocketMessageResponse, data: T) {
  if (conn.ws.readyState === conn.ws.OPEN) {
    conn.ws.send(JSON.stringify({
      res,
      data
    }))
  }
}

export function sendMessages<T>(conns: SocketConnection[], type: SocketMessageResponse, data: T) {
  conns.forEach((ws) => {
    if (ws.ws.readyState === ws.ws.OPEN) {
      sendMessage<T>(ws, type, data)
    }
  })
}
