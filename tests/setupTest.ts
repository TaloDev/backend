import { getTestContext } from './testContext.js'

vi.mock('nodemailer')

vi.mock('bullmq')

beforeAll(async () => {
  const context = await getTestContext()
  global.app = context.app
  global.ctx = context.ctx
  global.em = context.em
  global.clickhouse = context.clickhouse
  global.redis = context.redis
})

beforeEach(async () => {
  global.em.clear()

  const clickhouseTablesToTruncate = [
    'events',
    'event_props',
    'player_game_stat_snapshots',
    'player_sessions',
  ]

  await Promise.all([
    global.redis.flushdb(),
    ...clickhouseTablesToTruncate.map((table) =>
      global.clickhouse.command({ query: `TRUNCATE TABLE ${table}` }),
    ),
  ])
})
