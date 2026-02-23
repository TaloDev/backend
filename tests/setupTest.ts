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

  const clickhouseTablesToTruncate = ['events', 'player_game_stat_snapshots']

  await Promise.all([
    global.redis.flushall(),
    ...clickhouseTablesToTruncate.map((table) =>
      global.clickhouse.command({ query: `TRUNCATE TABLE ${table}` }),
    ),
  ])
})
