import { isValid } from 'date-fns'
import { Context, Next } from 'koa'
import { APIKeyScope } from '../entities/api-key'
import { isAPIRoute } from '../lib/routing/route-info'
import checkScope from '../policies/checkScope'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'

export async function continuityMiddleware(ctx: Context, next: Next) {
  if (isAPIRoute(ctx) && checkScope(ctx.state.key, APIKeyScope.WRITE_CONTINUITY_REQUESTS)) {
    const header = ctx.headers['x-talo-continuity-timestamp']

    if (header) {
      const date = new Date(Number(header))
      if (isValid(date)) {
        ctx.state.continuityDate = date
        setTraceAttributes({ continuity_date: date.toISOString() })
      }
    }
  }

  await next()
}
