import 'dotenv/config'
import { MikroORM } from '@mikro-orm/core'

let interval: NodeJS.Timeout

const done = () => {
  clearInterval(interval)
}

const createSchema = async () => {
  try {
    const orm = await MikroORM.init()
    const generator = orm.getSchemaGenerator()
    await generator.createSchema()
    await orm.close(true)
  } catch (err) {
    console.log(err.code)
    if (err.code !== 'PROTOCOL_CONNECTION_LOST') {
      console.error(err)
      done()
    }
  }
}

interval = setInterval(async () => {
  console.log('Checking DB connection...')
  await createSchema()
  console.log('Schema created')
  done()
}, 2000)

