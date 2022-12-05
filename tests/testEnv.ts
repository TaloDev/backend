import { EntityManager, MikroORM } from '@mikro-orm/core'
import init from '../src'
import ormConfig from '../src/config/mikro-orm.config'

beforeAll(async () => {
  const orm = await MikroORM.init(ormConfig)
  const generator = orm.getSchemaGenerator()
  await generator.refreshDatabase()
  await generator.clearDatabase()
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
