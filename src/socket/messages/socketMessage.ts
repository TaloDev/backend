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
  'v1.channels.message',
  'v1.channels.deleted',
  'v1.channels.ownership-transferred'
] as const

export type SocketMessageResponse = typeof responses[number]

export async function sendMessage<T extends object>(conn: SocketConnection, res: SocketMessageResponse, data: T) {
  await conn.sendMessage(res, data)
}

export async function sendMessages<T extends object>(conns: SocketConnection[], type: SocketMessageResponse, data: T) {
  await Promise.all(conns.map((conn) => conn.sendMessage(type, data)))
}
