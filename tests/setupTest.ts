import { EntityManager, MikroORM } from '@mikro-orm/core'
import init from '../src'
import ormConfig from '../src/config/mikro-orm.config'

beforeAll(async () => {
  vi.mock('@sendgrid/mail')
  vi.mock('bullmq')

  const orm = await MikroORM.init(ormConfig)
  await orm.getSchemaGenerator().clearDatabase()
  await orm.close(true)

  const app = await init()
  global.app = app.callback()
  global.em = app.context.em
})

afterAll(async () => {
  await (global.em as EntityManager).getConnection().close(true)
  delete global.em
  delete global.app
})
