import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { Context, Next } from 'koa'

export default async function loggerMiddleware(ctx: Context, next: Next) {
  if (ctx.path === '/public/health') {
    return await next()
  }

  const startTime = Date.now()
  console.info(`--> ${ctx.method} ${ctx.path}`)

  ctx.res.on('finish', () => {
    const endTime = Date.now()
    const timeMs = endTime - startTime

    setTraceAttributes({
      'clay.matched_route': ctx.state.matchedRoute,
      'clay.matched_key': ctx.state.matchedServiceKey,
      'clay.forward_handler': ctx.state.forwardHandler?.handler,
      'http.time_taken_ms': timeMs
    })

    console.info(`<-- ${ctx.method} ${ctx.path} ${ctx.status}`)
  })

  await next()
}
