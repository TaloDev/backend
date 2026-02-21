import { RequestContext } from '@mikro-orm/mysql'
import { Context, Next } from 'koa'

export async function requestContextMiddleware(ctx: Context, next: Next): Promise<void> {
  return RequestContext.create(ctx.em, next)
}
