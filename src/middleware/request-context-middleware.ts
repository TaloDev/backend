import { Context, Next } from 'koa'
import { RequestContext } from '@mikro-orm/mysql'

export default async function requestContextMiddleware(ctx: Context, next: Next): Promise<void> {
  return RequestContext.create(ctx.em, next)
}
