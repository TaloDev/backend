import cors from '@koa/cors'
import { Context, Next } from 'koa'
import { isAPIRoute, isPublicHealthCheck } from '../lib/routing/route-info'

export async function corsMiddleware(ctx: Context, next: Next): Promise<void> {
  if (isPublicHealthCheck(ctx) || isAPIRoute(ctx)) {
    return cors()(ctx, next)
  } else {
    return cors({
      credentials: true,
      origin: process.env.DASHBOARD_URL,
    })(ctx, next)
  }
}
