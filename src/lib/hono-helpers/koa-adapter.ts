import { Hono, Env } from 'hono'
import Koa from 'koa'

export function honoToKoa<E extends Env = Env>(honoApp: Hono<E>): Koa.Middleware {
  return async (ctx: Koa.Context, next: Koa.Next) => {
    const url = new URL(ctx.url, `${ctx.protocol}://${ctx.host}`)

    const hasBody = 'body' in ctx.request && !['GET', 'HEAD'].includes(ctx.method)
    const req = new Request(url.toString(), {
      method: ctx.method,
      headers: ctx.headers as Record<string, string>,
      body: hasBody ? JSON.stringify(ctx.request.body) : undefined
    })

    const env = {
      koaCtx: ctx
    }

    const res = await honoApp.fetch(req, env)
    if (res.status === 404) {
      await next()
      return
    }

    ctx.status = res.status
    res.headers.forEach((value, key) => {
      ctx.set(key, value)
    })

    if (res.body) {
      const contentType = res.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        ctx.body = await res.json()
      } else if (res.status === 204) {
        ctx.body = null
      } else {
        ctx.body = await res.text()
      }
    }
  }
}
