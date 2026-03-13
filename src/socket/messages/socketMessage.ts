import SocketConnection from '../socketConnection'

export const requests = [
  'v1.players.identify',
  'v1.channels.message',
  'v1.player-relationships.broadcast',
] as const

export type SocketMessageRequest = (typeof requests)[number]

export const responses = [
  'v1.connected',
  'v1.error',
  'v1.players.identify.success',
  'v1.channels.player-joined',
  'v1.channels.player-left',
  'v1.channels.message',
  'v1.channels.deleted',
  'v1.channels.ownership-transferred',
  'v1.live-config.updated',
  'v1.players.presence.updated',
  'v1.channels.updated',
  'v1.channels.storage.updated',
  'v1.player-relationships.broadcast',
  'v1.player-relationships.subscription-created',
  'v1.player-relationships.subscription-confirmed',
  'v1.player-relationships.subscription-deleted',
] as const

export type SocketMessageResponse = (typeof responses)[number]

export const heartbeatMessage = 'v1.heartbeat'

export function sendMessage<T extends object>(
  conn: SocketConnection,
  res: SocketMessageResponse,
  data: T,
) {
  conn.sendMessage(res, data)
}

export function sendMessages<T extends object>(
  conns: SocketConnection[],
  type: SocketMessageResponse,
  data: T,
) {
  const message = JSON.stringify({ res: type, data })
  // pass empty object as data since we already have the serialised message
  conns.forEach((conn) => conn.sendMessage(type, {} as T, message))
}
