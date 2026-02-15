import { Next } from 'koa'
import { GlobalContext } from '../lib/routing/context'

export async function decodeParamsMiddleware(ctx: GlobalContext, next: Next) {
  for (const param in ctx.params) {
    ctx.params[param] = decodeURIComponent(ctx.params[param])
  }
  await next()
}
