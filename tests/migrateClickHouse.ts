import createClickHouseClient from '../src/lib/clickhouse/createClient.js'
import { runClickHouseMigrations } from '../src/migrations/clickhouse/index.js'

async function run() {
  const clickhouse = createClickHouseClient()
  await runClickHouseMigrations(clickhouse)
  await clickhouse.close()
}

void run()
