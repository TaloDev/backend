import createClickHouseClient from '../src/lib/clickhouse/createClient'
import { runClickHouseMigrations } from '../src/migrations/clickhouse'

async function run() {
  const clickhouse = await createClickHouseClient()
  await runClickHouseMigrations(clickhouse)
  await clickhouse.close()
}

run()
