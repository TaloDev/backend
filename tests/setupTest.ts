import init from '../src'
import { createRedisConnection } from '../src/config/redis.config'

beforeAll(async () => {
  vi.mock('nodemailer')
  vi.mock('bullmq')

  const app = await init()
  global.app = app.callback()
  global.ctx = app.context
  global.em = app.context.em.fork()
  global.clickhouse = app.context.clickhouse
  global.redis = createRedisConnection()
})

beforeEach(async () => {
  global.em.clear()
  await global.redis.flushall()
})

afterAll(async () => {
  await global.em.getConnection().close(true)
  await global.clickhouse.close()
  await global.redis.quit()
})
