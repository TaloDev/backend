import { EntityManager, MikroORM } from '@mikro-orm/mysql'
import init from '../src'
import ormConfig from '../src/config/mikro-orm.config'
import createClickhouseClient from '../src/lib/clickhouse/createClient'
import { NodeClickHouseClient } from '@clickhouse/client/dist/client'
import { createServer } from 'http'

beforeAll(async () => {
  vi.mock('@sendgrid/mail')
  vi.mock('bullmq')

  const orm = await MikroORM.init(ormConfig)
  await orm.getSchemaGenerator().clearDatabase()
  await orm.close(true)

  const app = await init()
  global.app = app.callback()
  global.em = app.context.em

  global.server = createServer()
  global.server.listen(0)

  global.clickhouse = createClickhouseClient()
  await (global.clickhouse as NodeClickHouseClient).command({
    query: `TRUNCATE ALL TABLES from ${process.env.CLICKHOUSE_DB}`
  })
})

afterAll(async () => {
  await (global.em as EntityManager).getConnection().close(true)

  global.server.close()

  const clickhouse = global.clickhouse as NodeClickHouseClient
  clickhouse.close()

  delete global.em
  delete global.app
  delete global.server
  delete global.clickhouse
})
