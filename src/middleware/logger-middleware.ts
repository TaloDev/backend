import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { Context, Next } from 'koa'

export default async function loggerMiddleware(ctx: Context, next: Next) {
  const startTime = Date.now()

  setTraceAttributes({
    'http.method': ctx.method,
    'http.route': ctx.path
  })
  console.info(`--> ${ctx.method} ${ctx.path}`)

  ctx.res.on('finish', () => {
    const status = ctx.status
    const endTime = Date.now()
    const timeMs = endTime - startTime

    setTraceAttributes({
      'http.method': ctx.method,
      'http.route': ctx.path,
      'http.status': status,
      'http.time_taken_ms': timeMs,
      'http.response_size': ctx.response.length,
      'clay.matched_route': ctx.state.matchedRoute,
      'clay.matched_key': ctx.state.matchedServiceKey,
      'clay.forward_handler': ctx.state.forwardHandler?.handler
    })
    console.info(`<-- ${ctx.method} ${ctx.path} ${status}`)
  })

  await next()
}
