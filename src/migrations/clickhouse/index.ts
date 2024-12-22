import { ClickHouseClient } from '@clickhouse/client'
import { CreateEventsTable } from './001CreateEventsTable'
import { CreateEventPropsTable } from './002CreateEventPropsTable'
import { CreateSocketEventsTable } from './003CreateSocketEventsTable'
import { CreateMigrationsTable } from './000CreateMigrationsTable'
import { formatDateForClickHouse } from '../../lib/clickhouse/formatDateTime'

type ClickhouseMigration = {
  name: string
  sql: string
}

const migrations: ClickhouseMigration[] = [
  {
    name: 'CreateEventsTable',
    sql: CreateEventsTable
  },
  {
    name: 'CreateEventPropsTable',
    sql: CreateEventPropsTable
  },
  {
    name: 'CreateSocketEventsTable',
    sql: CreateSocketEventsTable
  }
]

export async function runClickhouseMigrations(clickhouse: ClickHouseClient) {
  console.info('Running ClickHouse migrations...')

  await clickhouse.query({ query: CreateMigrationsTable })

  const completedMigrations = await clickhouse.query({
    query: 'SELECT name FROM migrations',
    format: 'JSONEachRow'
  }).then((res) => res.json<{ name: string }>())

  const pendingMigrations = migrations.filter((migration) => {
    return !completedMigrations.map((row) => row.name).includes(migration.name)
  })

  for (const migration of pendingMigrations) {
    console.info(`Applied '${migration.name}'`)
    await clickhouse.query({ query: migration.sql })
  }

  await clickhouse.insert({
    table: 'migrations',
    values: pendingMigrations.map((migration) => ({
      name: migration.name,
      executed_at: formatDateForClickHouse(new Date())
    })),
    format: 'JSONEachRow'
  })

  console.info('ClickHouse up to date!')
}
