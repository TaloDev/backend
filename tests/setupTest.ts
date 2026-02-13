import { getTestContext } from './testContext'

beforeAll(async () => {
  vi.mock('nodemailer')
  vi.mock('bullmq')

  const context = await getTestContext()
  global.app = context.app
  global.ctx = context.ctx
  global.em = context.em
  global.clickhouse = context.clickhouse
  global.redis = context.redis
})

beforeEach(async () => {
  global.em.clear()
  await global.redis.flushall()
})
