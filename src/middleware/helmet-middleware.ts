import { Context, Next } from 'koa'
import helmet from 'koa-helmet'

// re-export to give the middleware a name in traces
export default async function helmetMiddleware(ctx: Context, next: Next): Promise<void> {
  return helmet()(ctx, next)
}
