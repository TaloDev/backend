import 'dotenv/config'
import { MikroORM } from '@mikro-orm/core'
import { exec } from 'child_process'

let interval: NodeJS.Timeout
let lastOutput: string = 'Waiting for DB to be ready '

const done = (): void => {
  clearInterval(interval)
}

const createSchema = async (): Promise<void> => {
  try {
    const orm = await MikroORM.init()
    const generator = orm.getSchemaGenerator()
    await generator.createSchema()
    await orm.close(true)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}


interval = setInterval(async () => {
  lastOutput = `${lastOutput}.`
  process.stdout.write(`${lastOutput}\r`)

  exec('docker logs gs-test_db_1 -n 1', async (err, stdout, stderr) => {
    if (stderr.includes('[MY-010931]')) {
      done()
      await createSchema()
    }
  })
}, 1000)
