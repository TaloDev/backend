import { Context, Next } from 'koa'
import cors from '@koa/cors'

export default async (ctx: Context, next: Next): Promise<void> => {
  if (ctx.path.match(/^\/(v1)\//)) {
    return cors()(ctx, next)
  } else {
    return cors({
      credentials: true,
      origin: process.env.DASHBOARD_URL
    })(ctx, next)
  }
}
