import init from '../src'
import { createRedisConnection } from '../src/config/redis.config'
import { getWorkerDatabaseConfig } from './lib/getWorkerConfig'
import { setupMySQLDatabase, setupClickHouseDatabase } from './lib/setupWorkerDatabase'
import { WorkerDatabaseConfig } from './lib/getWorkerConfig'

let workerConfig: WorkerDatabaseConfig

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
    query: `TRUNCATE ALL TABLES from ${workerConfig.clickhouseDatabase}`
  })
}

beforeAll(async () => {
  vi.mock('nodemailer')
  vi.mock('bullmq')

  workerConfig = getWorkerDatabaseConfig()
  await setupMySQLDatabase(workerConfig)
  await setupClickHouseDatabase(workerConfig)

  const app = await init()
  global.app = app.callback()
  global.ctx = app.context
  global.em = app.context.em.fork()
  global.clickhouse = app.context.clickhouse
  global.redis = createRedisConnection({ keyPrefix: workerConfig.redisKeyPrefix })

  await truncateTables()
})

beforeEach(async () => {
  global.em.clear()

  const keys = await global.redis.keys('*')
  if (keys.length > 0) {
    await global.redis.del(...keys)
  }
})

afterAll(async () => {
  // Close connections but keep databases alive for next test file
  await global.em.getConnection().close(true)
  await global.clickhouse.close()
  await global.redis.quit()

  // Note: We no longer drop databases between test files
  // Databases persist for the entire test run and are cleaned up by Docker shutdown
})
