import { EntityManager, MikroORM } from '@mikro-orm/mysql'
import init from '../src'
import ormConfig from '../src/config/mikro-orm.config'
import { ClickHouseClient } from '@clickhouse/client'
import { createServer, Server } from 'http'

beforeAll(async () => {
  vi.mock('@sendgrid/mail')
  vi.mock('bullmq')

  const orm = await MikroORM.init(ormConfig)
  await orm.getSchemaGenerator().clearDatabase()
  await orm.close(true)

  const app = await init()
  global.app = app.callback()
  global.ctx = app.context
  global.em = app.context.em

  vi.stubEnv('DISABLE_SOCKET_EVENTS', '1')
  global.server = createServer()
  global.server.listen(0)

  global.clickhouse = app.context.clickhouse
  await (global.clickhouse as ClickHouseClient).command({
    query: `TRUNCATE ALL TABLES from ${process.env.CLICKHOUSE_DB}`
  })
})

afterAll(async () => {
  const em: EntityManager = global.em
  await em.getConnection().close(true)

  const server: Server = global.server
  server.close()

  const clickhouse: ClickHouseClient = global.clickhouse
  await clickhouse.close()

  delete global.app
  delete global.ctx
  delete global.em
  delete global.server
  delete global.clickhouse
})
