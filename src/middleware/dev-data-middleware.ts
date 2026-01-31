import { Context, Next } from 'koa'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'

export default async function devDataMiddleware(ctx: Context, next: Next) {
  if (Number(ctx.headers['x-talo-include-dev-data'])) {
    ctx.state.includeDevData = true
  }

  setTraceAttributes({ dev_data: ctx.state.includeDevData ? 'true' : 'false' })

  await next()
}
