import { Context } from 'koa'
import cors from '@koa/cors'

export default async (ctx: Context, next: Function) => {
  if (ctx.path.match(/^\/(api)/)) {
    return await next()
  } else {
    return cors({ credentials: true, origin: process.env.ALLOWED_ORIGINS })(ctx, next)
  }
}
