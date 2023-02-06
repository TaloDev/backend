import { Context, Next } from 'koa'
import cors from '@koa/cors'
import { isAPIRoute } from './route-middleware'

export default async (ctx: Context, next: Next): Promise<void> => {
  if (isAPIRoute(ctx)) {
    return cors()(ctx, next)
  } else {
    return cors({
      credentials: true,
      origin: process.env.DASHBOARD_URL
    })(ctx, next)
  }
}
