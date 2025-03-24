import { MikroORM } from '@mikro-orm/mysql'
import init from '../src'
import ormConfig from '../src/config/mikro-orm.config'

beforeAll(async () => {
  vi.mock('@sendgrid/mail')
  vi.mock('bullmq')
  vi.stubEnv('DISABLE_SOCKET_EVENTS', '1')

  const orm = await MikroORM.init(ormConfig)
  await orm.getSchemaGenerator().clearDatabase()
  await orm.close(true)

  const app = await init()
  global.app = app.callback()
  global.ctx = app.context
  global.em = app.context.em

  global.clickhouse = app.context.clickhouse
  await (global.clickhouse).command({
    query: `TRUNCATE ALL TABLES from ${process.env.CLICKHOUSE_DB}`
  })
})

afterAll(async () => {
  await global.em.getConnection().close(true)
  await global.clickhouse.close()
})
