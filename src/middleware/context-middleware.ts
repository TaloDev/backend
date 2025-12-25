import { createMiddleware } from 'hono/factory'
import { EntityManager } from '@mikro-orm/mysql'
import assert from 'assert'

export const contextMiddleware = createMiddleware(async (c, next) => {
  const koa = c.env.koaCtx
  assert(koa)

  if (koa.em) {
    const em: EntityManager = koa.em.fork()
    c.set('em', em)
  }

  if (koa.redis) {
    c.set('redis', koa.redis)
  }

  if (koa.clickhouse) {
    c.set('clickhouse', koa.clickhouse)
  }

  if (koa.wss) {
    c.set('wss', koa.wss)
  }

  await next()
})
