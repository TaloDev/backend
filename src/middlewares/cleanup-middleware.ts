import Redis from 'ioredis'
import { Context, Next } from 'koa'

export default async function cleanupMiddleware(ctx: Context, next: Next): Promise<void> {
  if (ctx.state.redis instanceof Redis) {
    await (ctx.state.redis as Redis).quit()
  }

  await next()
}
