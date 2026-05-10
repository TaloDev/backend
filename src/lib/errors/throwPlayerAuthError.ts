import type { Context } from 'koa'
import type { PlayerAuthErrorCode } from '../../entities/player-auth.js'

export function throwPlayerAuthError({
  ctx,
  status,
  message,
  errorCode,
}: {
  ctx: Context
  status: number
  message: string
  errorCode: PlayerAuthErrorCode
}): never {
  return ctx.throw(status, { message, errorCode })
}
