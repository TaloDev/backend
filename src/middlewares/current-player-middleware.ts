import { Context, Next } from 'koa'

export default async (ctx: Context, next: Next): Promise<void> => {
  ctx.state.currentPlayerId = ctx.headers['x-talo-player']
  ctx.state.currentAliasId = ctx.headers['x-talo-alias'] ? Number(ctx.headers['x-talo-alias']) : undefined

  await next()
}
