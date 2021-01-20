import { Context, Next } from 'koa'
import cors from '@koa/cors'

export default async (ctx: Context, next: Next) => {
  if (ctx.path.match(/^\/(api)/)) {
    await next()
  } else {
    return cors({ 
      credentials: true,
      origin: process.env.ALLOWED_ORIGINS
    })(ctx, next)
  }
}
