import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http'
import { Context, Next } from 'koa'

const DENYLIST = [
  'authorization',
  'code',
  'cookie',
  'email',
  'password',
  'qr',
  'secret',
  'session',
  'stripe-signature',
  'token'
].map((item) => item.toLowerCase())

const ALLOWLIST = [
  'emailConfirmed'
].map((item) => item.toLowerCase())

function deepFilterDataInternal<T>(obj: T, visited: WeakSet<object>): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj
  }

  // prevent infinite recursion from circular references
  if (visited.has(obj as object)) {
    return '[Circular]' as T
  }
  visited.add(obj as object)

  if (Array.isArray(obj)) {
    return obj.map((item) => deepFilterDataInternal(item, visited)) as T
  }

  // skip objects that can't be safely iterated (like functions, dates, etc.)
  if (obj instanceof Date || obj instanceof RegExp || typeof obj === 'function') {
    return obj
  }

  try {
    const filtered: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase()
      const inDenyList = DENYLIST.some((deniedKey) => keyLower.includes(deniedKey))
      const inAllowList = ALLOWLIST.some((allowedKey) => keyLower.includes(allowedKey))

      if (inDenyList && !inAllowList) {
        // handle array values in filtered fields (like headers)
        if (Array.isArray(value)) {
          filtered[key] = value.map(() => '[Filtered]')
        } else {
          filtered[key] = '[Filtered]'
        }
      } else {
        filtered[key] = deepFilterDataInternal(value, visited)
      }
    }
    return filtered as T
  } catch {
    // if we can't iterate the object safely, return it as-is
    return obj
  }
}

export function deepFilterData<T>(obj: T | string): T {
  return deepFilterDataInternal(JSON.parse(JSON.stringify(obj)), new WeakSet())
}

function buildHeaders(prefix: 'request' | 'response', headers: IncomingHttpHeaders | OutgoingHttpHeaders) {
  return Object.entries(deepFilterData(headers)).reduce((acc, [key, value]) => {
    return {
      ...acc,
      [`http.${prefix}.header.${key.toLowerCase()}`]: value
    }
  }, {})
}

export default async function httpTracingMiddleware(ctx: Context, next: Next) {
  if (ctx.path === '/public/health') {
    return await next()
  }

  setTraceAttributes({
    ...buildHeaders('request', ctx.request.headers),
    'http.method': ctx.method,
    'http.route': ctx.path,
    'http.request.body': JSON.stringify(deepFilterData(ctx.request.body))
  })

  ctx.res.on('finish', () => {
    setTraceAttributes({
      ...buildHeaders('response', ctx.response.headers),
      'http.response_size': ctx.response.length,
      'http.response.body': JSON.stringify(deepFilterData(ctx.response.body))
    })
  })

  await next()
}
