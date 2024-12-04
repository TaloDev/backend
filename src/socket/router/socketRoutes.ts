import { z, ZodType } from 'zod'
import { SocketMessageRequest } from '../messages/socketMessage'
import SocketConnection from '../socketConnection'
import Socket from '..'
import playerListeners from '../listeners/playerListeners'

type SocketMessageListenerHandlerParams<T> = {
  conn: SocketConnection
  req: SocketMessageRequest
  data: T
  socket: Socket
}

export type SocketMessageListenerHandler<T> = (params: SocketMessageListenerHandlerParams<T>) => void | Promise<void>

export type SocketMessageListener<T extends ZodType> = {
  req: SocketMessageRequest
  validator: T
  handler: SocketMessageListenerHandler<z.infer<T>>
  requirePlayer: boolean
}

const routes: SocketMessageListener<ZodType>[][] = [
  playerListeners
]

export default routes
