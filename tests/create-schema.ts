import 'dotenv/config'
import { MikroORM } from '@mikro-orm/core'
import { exec } from 'child_process'

let interval: NodeJS.Timeout
let log: string = 'Waiting for DB to be ready '

const createSchema = async (): Promise<void> => {
  try {
    const orm = await MikroORM.init()
    const generator = orm.getSchemaGenerator()
    await generator.dropSchema()
    await generator.createSchema()
    await orm.close(true)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

process.stdout.write(`${log}\r`)

interval = setInterval(async () => {
  log += '.'
  process.stdout.write(`${log}\r`)

  exec('docker logs gs-test_db_1 -n 1', async (err, stdout, stderr) => {
    if (stderr.includes('[MY-010931]')) {
      clearInterval(interval)
      await createSchema()
      process.exit(0)
    }
  })
}, 5000)
