import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { Context, Next } from 'koa'
import { isPublicHealthCheck } from '../lib/routing/route-info'

export async function loggerMiddleware(ctx: Context, next: Next) {
  if (isPublicHealthCheck(ctx)) {
    return next()
  }

  const startTime = Date.now()

  setTraceAttributes({
    'http.talo_client': ctx.request.headers['x-talo-client'],
  })

  console.info(`--> ${ctx.method} ${ctx.path}`)

  ctx.res.on('finish', () => {
    const status = ctx.status
    const endTime = Date.now()
    const timeMs = endTime - startTime

    setTraceAttributes({
      'http.status': status,
      'http.time_taken_ms': timeMs,
    })

    console.info(`<-- ${ctx.method} ${ctx.path} ${status}`)
  })

  await next()
}
