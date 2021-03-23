import { MikroORM } from '@mikro-orm/core'

const createSchema = async (): Promise<void> => {
  try {
    const orm = await MikroORM.init()
    const generator = orm.getSchemaGenerator()
    await generator.dropSchema()
    await generator.createSchema()
    await orm.close(true)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

createSchema()
