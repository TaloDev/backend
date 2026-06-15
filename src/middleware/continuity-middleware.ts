import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { isValid } from 'date-fns'
import { Context, Next } from 'koa'
import { APIKeyScope } from '../entities/api-key.js'
import { isAPIRoute } from '../lib/routing/route-info.js'
import checkScope from '../policies/checkScope.js'

export async function continuityMiddleware(ctx: Context, next: Next) {
  if (isAPIRoute(ctx) && checkScope(ctx.state.key, APIKeyScope.WRITE_CONTINUITY_REQUESTS)) {
    const header = ctx.headers['x-talo-continuity-timestamp']

    if (header) {
      const date = new Date(Number(header))
      if (isValid(date) && date.getTime() <= Date.now() + 1000) {
        ctx.state.continuityDate = date
        setTraceAttributes({ continuity_date: date.toISOString() })
      }
    }
  }

  await next()
}
