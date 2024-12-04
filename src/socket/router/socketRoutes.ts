import { z, ZodType } from 'zod'
import { SocketMessageRequest } from '../socketMessage'
import SocketConnection from '../socketConnection'
import Socket from '..'
import playerListeners from '../listeners/playerListeners'

export type SocketMessageListenerHandler<T> = (conn: SocketConnection, data: T, socket: Socket) => void | Promise<void>

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
