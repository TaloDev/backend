import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { Context, Next } from 'koa'
import { isPublicHealthCheck } from './route-middleware'

export default async function loggerMiddleware(ctx: Context, next: Next) {
  if (isPublicHealthCheck(ctx)) {
    return await next()
  }

  const startTime = Date.now()

  setTraceAttributes({
    'http.talo_client': ctx.request.headers['x-talo-client']
  })

  console.info(`--> ${ctx.method} ${ctx.path}`)

  ctx.res.on('finish', () => {
    const status = ctx.status
    const endTime = Date.now()
    const timeMs = endTime - startTime

    setTraceAttributes({
      'clay.matched_route': ctx.state.matchedRoute,
      'clay.matched_key': ctx.state.matchedServiceKey,
      'clay.forward_handler': ctx.state.forwardHandler?.handler,
      'http.status': status,
      'http.time_taken_ms': timeMs
    })

    console.info(`<-- ${ctx.method} ${ctx.path} ${status}`)
  })

  await next()
}
