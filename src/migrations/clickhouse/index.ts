import { ClickHouseClient } from '@clickhouse/client'
import { CreateEventsTable } from './001CreateEventsTable'
import { CreateEventPropsTable } from './002CreateEventPropsTable'
import { CreateSocketEventsTable } from './003CreateSocketEventsTable'
import { CreateMigrationsTable } from './000CreateMigrationsTable'
import { formatDateForClickHouse } from '../../lib/clickhouse/formatDateTime'
import { CreatePlayerGameStatSnapshotsTable } from './004CreatePlayerGameStatSnapshotsTable'

type ClickHouseMigration = {
  name: string
  sql: string
}

const migrations: ClickHouseMigration[] = [
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
  },
  {
    name: 'CreatePlayerGameStatSnapshotsTable',
    sql: CreatePlayerGameStatSnapshotsTable
  }
]

export async function runClickHouseMigrations(clickhouse: ClickHouseClient) {
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
    console.info(`Processing '${migration.name}'`)
    await clickhouse.query({ query: migration.sql })
    await clickhouse.insert({
      table: 'migrations',
      values: [{
        name: migration.name,
        executed_at: formatDateForClickHouse(new Date(), false)
      }],
      format: 'JSONEachRow'
    })
    console.info(`Applied '${migration.name}'`)
  }

  console.info('ClickHouse up to date!')
}
