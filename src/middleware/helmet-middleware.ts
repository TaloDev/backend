import { Context, Next } from 'koa'
import helmet from 'koa-helmet'

const helmetInstance = helmet()

export async function helmetMiddleware(ctx: Context, next: Next) {
  return helmetInstance(ctx, next)
}
