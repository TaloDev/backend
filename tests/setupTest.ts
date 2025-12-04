import init from '../src'
import { createRedisConnection } from '../src/config/redis.config'

async function truncateTables() {
  global.em.execute('SET FOREIGN_KEY_CHECKS = 0;')

  const tables = await global.em.execute(`
    SELECT table_name as tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
  `)

  for (const { tableName } of tables) {
    await global.em.execute(`TRUNCATE TABLE \`${tableName}\`;`)
  }

  global.em.execute('SET FOREIGN_KEY_CHECKS = 1;')

  await (global.clickhouse).command({
    query: `TRUNCATE ALL TABLES from ${process.env.CLICKHOUSE_DB}`
  })
}

beforeAll(async () => {
  vi.mock('nodemailer')
  vi.mock('bullmq')

  const app = await init()
  global.app = app.callback()
  global.ctx = app.context
  global.em = app.context.em.fork()
  global.clickhouse = app.context.clickhouse
  global.redis = createRedisConnection()

  await truncateTables()
})

beforeEach(async () => {
  global.em.clear()
  await global.redis.flushall()
})

afterAll(async () => {
  await global.em.getConnection().close(true)
  await global.clickhouse.close()
  await redis.quit()
})
