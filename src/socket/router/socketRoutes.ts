import { z, ZodType } from 'zod'
import { SocketMessageRequest } from '../messages/socketMessage'
import SocketConnection from '../socketConnection'
import Socket from '..'
import playerListeners from '../listeners/playerListeners'
import gameChannelListeners from '../listeners/gameChannelListeners'

type SocketMessageListenerHandlerParams<T> = {
  conn: SocketConnection
  req: SocketMessageRequest
  data: T
  socket: Socket
}

export type SocketMessageListenerHandler<T> = (params: SocketMessageListenerHandlerParams<T>) => void | Promise<void>
export type SocketMessageListenerOptions = {
  requirePlayer?: boolean
  apiKeyScopes?: string[]
}

export type SocketMessageListener<T extends ZodType> = {
  req: SocketMessageRequest
  validator: T
  handler: SocketMessageListenerHandler<z.infer<T>>
  options: SocketMessageListenerOptions
}

const routes: SocketMessageListener<ZodType>[][] = [
  playerListeners,
  gameChannelListeners
]

export default routes
