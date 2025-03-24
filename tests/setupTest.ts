import { MikroORM } from '@mikro-orm/mysql'
import init from '../src'
import ormConfig from '../src/config/mikro-orm.config'
import { ClickHouseClient } from '@clickhouse/client'

beforeAll(async () => {
  vi.mock('@sendgrid/mail')
  vi.mock('bullmq')
  vi.stubEnv('DISABLE_SOCKET_EVENTS', '1')

  const orm = await MikroORM.init(ormConfig)
  await orm.getSchemaGenerator().clearDatabase()
  await orm.close(true)

  const koa = await init()
  app = koa.callback()
  ctx = koa.context
  em = koa.context.em

  clickhouse = koa.context.clickhouse
  await (clickhouse as ClickHouseClient).command({
    query: `TRUNCATE ALL TABLES from ${process.env.CLICKHOUSE_DB}`
  })
})

afterAll(async () => {
  await em.getConnection().close(true)
  await clickhouse.close()
})
