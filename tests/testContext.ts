import init from '../src'
import { createRedisConnection } from '../src/config/redis.config'

type TestContext = {
  app: typeof global.app
  ctx: typeof global.ctx
  em: typeof global.em
  clickhouse: typeof global.clickhouse
  redis: typeof global.redis
}

let cachedContext: TestContext | null = null

export async function getTestContext() {
  if (!cachedContext) {
    const app = await init()
    cachedContext = {
      app: app.callback(),
      ctx: app.context,
      em: app.context.em.fork(),
      clickhouse: app.context.clickhouse,
      redis: createRedisConnection()
    }
  }
  return cachedContext
}
