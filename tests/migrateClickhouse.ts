import createClickhouseClient from '../src/lib/clickhouse/createClient'
import { runClickhouseMigrations } from '../src/migrations/clickhouse'

async function run() {
  const clickhouse = await createClickhouseClient()
  await runClickhouseMigrations(clickhouse)
  await clickhouse.close()
}

run()
