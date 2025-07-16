import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { Context, Next } from 'koa'

export function setCurrentPlayerState(ctx: Context, playerId: string, aliasId: number | undefined) {
  ctx.state.currentPlayerId = playerId
  ctx.state.currentAliasId = aliasId

  if (playerId) {
    setTraceAttributes({ player_id: playerId })
  }
  if (aliasId) {
    setTraceAttributes({ alias_id: aliasId })
  }
}

export default async function currentPlayerMiddleware(ctx: Context, next: Next): Promise<void> {
  setCurrentPlayerState(
    ctx, ctx.headers['x-talo-player'] as string,
    ctx.headers['x-talo-alias'] ? Number(ctx.headers['x-talo-alias']) : undefined
  )

  await next()
}

export function getAliasFromIdentifyCacheKey(service: string, identifier: string) {
  return `identify-${service}-${identifier}`
}
