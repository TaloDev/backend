import { MikroORM } from '@mikro-orm/core'

(async (): Promise<void> => {
  try {
    const orm = await MikroORM.init()

    const generator = orm.getSchemaGenerator()
    await generator.dropSchema()

    await orm.em.getConnection().execute(`drop table if exists mikro_orm_migrations`)

    await orm.close(true)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()
