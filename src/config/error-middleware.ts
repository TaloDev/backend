import { Context, Next } from 'koa'

export default async (ctx: Context, next: Next) => {
  try {
    await next()
  } catch (err) {
    const keys = Object.keys(err).length
    if (keys > 0) {
      ctx.status = err.status ?? 500
      ctx.body = err
    } else {
      ctx.onerror(err)
    }
  }
}
