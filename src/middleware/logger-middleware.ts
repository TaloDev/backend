import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http'
import { Context, Next } from 'koa'

// todo: unneeded when advanced network capture works
function buildHeaders(prefix: 'req' | 'res', headers: IncomingHttpHeaders | OutgoingHttpHeaders) {
  return Object.entries(headers).reduce((acc, [key, value]) => {
    return {
      ...acc,
      [`http.headers.${prefix}.${key.toLowerCase()}`]: value
    }
  }, {})
}

export default async function loggerMiddleware(ctx: Context, next: Next) {
  if (ctx.path === '/public/health') {
    return await next()
  }

  const startTime = Date.now()

  setTraceAttributes({
    'http.method': ctx.method,
    'http.route': ctx.path,
    ...buildHeaders('req', ctx.request.headers)
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
      ...buildHeaders('res', ctx.response.headers),
      'http.response_size': ctx.response.length,
      'clay.matched_route': ctx.state.matchedRoute,
      'clay.matched_key': ctx.state.matchedServiceKey,
      'clay.forward_handler': ctx.state.forwardHandler?.handler
    })
    console.info(`<-- ${ctx.method} ${ctx.path} ${status}`)
  })

  await next()
}
