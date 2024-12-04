import SocketConnection from '../socketConnection'

export const requests = [
  'v1.players.identify'
] as const

export type SocketMessageRequest = typeof requests[number]

export const responses = [
  'v1.connected',
  'v1.error',
  'v1.players.identify.success'
] as const

export type SocketMessageResponse = typeof responses[number]

export function sendMessage<T>(conn: SocketConnection, res: SocketMessageResponse, data: T) {
  conn.ws.send(JSON.stringify({
    res,
    data
  }))
}

export function sendMessages<T>(conns: SocketConnection[], type: SocketMessageResponse, data: T) {
  conns.forEach((ws) => sendMessage<T>(ws, type, data))
}
