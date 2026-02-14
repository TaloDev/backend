import { Context, Next } from 'koa'

export async function trailingSlashMiddleware(ctx: Context, next: Next) {
  if (ctx.path !== '/' && ctx.path.endsWith('/')) {
    ctx.path = ctx.path.slice(0, -1)
  }
  await next()
}
