import { Context, Next } from 'koa'

export default async (ctx: Context, next: Next) => {
  try {
    await next()
  } catch (err) {
    ctx.status = err.status || 500
    ctx.body = {
      ...err
    }

    if (ctx.status === 500) console.error(err.stack)
  }
}
