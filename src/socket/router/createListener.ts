import { z, ZodType } from 'zod'
import { SocketMessageRequest } from '../messages/socketMessage'
import SocketConnection from '../socketConnection'
import Socket from '..'
import { APIKeyScope } from '../../entities/api-key'

type SocketMessageListenerHandlerParams<T> = {
  conn: SocketConnection
  req: SocketMessageRequest
  data: T
  socket: Socket
}

type SocketMessageListenerHandler<T> = (params: SocketMessageListenerHandlerParams<T>) => void | Promise<void>
type SocketMessageListenerOptions = {
  requirePlayer?: boolean
  apiKeyScopes?: APIKeyScope[]
}

export type SocketMessageListener<T extends ZodType> = {
  req: SocketMessageRequest
  validator: T
  handler: SocketMessageListenerHandler<z.infer<T>>
  options?: SocketMessageListenerOptions
}

export default function createListener<T extends ZodType>(
  req: SocketMessageRequest,
  validator: T,
  handler: SocketMessageListenerHandler<z.infer<T>>,
  options?: SocketMessageListenerOptions
): SocketMessageListener<T> {
  return {
    req,
    validator,
    handler,
    options
  }
}
