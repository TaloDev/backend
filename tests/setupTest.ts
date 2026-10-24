import { getTestContext } from './testContext.js'

vi.mock('nodemailer')

vi.mock('bullmq')

vi.mock('@hyperdx/node-opentelemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@hyperdx/node-opentelemetry')>()),
  recordException: vi.fn(),
}))

vi.mock('@sentry/node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sentry/node')>()),
  captureException: vi.fn(),
}))

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
