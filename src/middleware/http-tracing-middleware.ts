import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http'
import { Context, Next } from 'koa'
import { isPublicHealthCheck } from '../lib/routing/route-info.js'

const DENYLIST = [
  'code',
  'cookie',
  'email',
  'password',
  'qr',
  'secret',
  'session',
  'stripe-signature',
  'token',
]

const ALLOWLIST = new Set(['emailconfirmed'])

function isShallowFilteredObject(obj: unknown): obj is Record<string, unknown> {
  if (obj === null || typeof obj !== 'object') return false
  if (Array.isArray(obj) || obj instanceof Date || obj instanceof RegExp) return false
  if (typeof obj === 'function') return false
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue
    const value = (obj as Record<string, unknown>)[key]
    if (value !== null && typeof value === 'object') return false
  }
  return true
}

function filterShallow(obj: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {}
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue
    const value = obj[key]
    const keyLower = key.toLowerCase()
    const inDenyList = DENYLIST.some((deniedKey) => keyLower.includes(deniedKey))
    const inAllowList = ALLOWLIST.has(keyLower)

    if (inDenyList && !inAllowList) {
      filtered[key] = Array.isArray(value) ? value.map(() => '[Filtered]') : '[Filtered]'
    } else {
      filtered[key] = value
    }
  }
  return filtered
}

function deepFilterDataInternal<T>(obj: T, visited: WeakSet<object>): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj
  }

  if (visited.has(obj as object)) {
    return '[Circular]' as T
  }
  visited.add(obj as object)

  if (isShallowFilteredObject(obj)) {
    return filterShallow(obj) as T
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepFilterDataInternal(item, visited)) as T
  }

  if (obj instanceof Date || obj instanceof RegExp || typeof obj === 'function') {
    return obj
  }

  try {
    const filtered: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase()
      const inDenyList = DENYLIST.some((deniedKey) => keyLower.includes(deniedKey))
      const inAllowList = ALLOWLIST.has(keyLower)

      if (inDenyList && !inAllowList) {
        filtered[key] = Array.isArray(value) ? value.map(() => '[Filtered]') : '[Filtered]'
      } else {
        filtered[key] = deepFilterDataInternal(value, visited)
      }
    }
    return filtered as T
  } catch {
    return obj
  }
}

export function deepFilterData<T>(obj: T | string): T {
  if (typeof obj === 'string') {
    return obj as T
  }

  return deepFilterDataInternal(obj, new WeakSet())
}

function buildHeaders(
  prefix: 'request' | 'response',
  headers: IncomingHttpHeaders | OutgoingHttpHeaders,
) {
  const filtered = deepFilterData(headers) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key in filtered) {
    if (!Object.prototype.hasOwnProperty.call(filtered, key)) {
      continue
    }
    out[`http.${prefix}.header.${key.toLowerCase()}`] = filtered[key]
  }

  return out
}

function safeStringifyBody(body: unknown) {
  if (!body) {
    return ''
  }

  const maxSize = 20 * 1024

  try {
    if (typeof body === 'string') {
      return body.length > maxSize ? '[Too large]' : body
    }

    const preliminary = JSON.stringify(body)
    if (preliminary.length > maxSize) {
      return '[Too large]'
    }

    return JSON.stringify(deepFilterData(body))
  } catch {
    return ''
  }
}

export async function httpTracingMiddleware(ctx: Context, next: Next) {
  if (isPublicHealthCheck(ctx)) {
    return next()
  }

  setTraceAttributes({
    ...buildHeaders('request', ctx.request.headers),
    'http.method': ctx.method,
    'http.route': ctx.path,
    'http.request.body': safeStringifyBody(ctx.request.body),
  })

  ctx.res.on('finish', () => {
    setTraceAttributes({
      ...buildHeaders('response', ctx.response.headers),
      'http.response_size': ctx.response.length,
      'http.response.body': safeStringifyBody(ctx.response.body),
    })
  })

  await next()
}
