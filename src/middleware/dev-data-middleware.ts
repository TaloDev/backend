import { Context, Next } from 'koa'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'

export async function devDataMiddleware(ctx: Context, next: Next) {
  ctx.state.includeDevData = !!Number(ctx.headers['x-talo-include-dev-data'])
  ctx.state.devBuild = !!Number(ctx.headers['x-talo-dev-build'])

  setTraceAttributes({
    dev_data: ctx.state.includeDevData ? 'true' : 'false',
    dev_build: ctx.state.devBuild ? 'true' : 'false'
  })

  await next()
}
