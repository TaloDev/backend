import 'dotenv/config'
import { MikroORM } from '@mikro-orm/core'
import UserFactory from './fixtures/UserFactory'
import User from '../src/entities/user'

(async () => {
  const orm = await MikroORM.init()
  const generator = orm.getSchemaGenerator()
  await generator.dropSchema()
  await generator.createSchema()

  const userFactory = new UserFactory()
  const users: User[] = userFactory.state('email confirmed').many(10)

  await orm.em.getRepository(User).persistAndFlush(users)
  await orm.close(true)
})()
