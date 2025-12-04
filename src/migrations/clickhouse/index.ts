import { ClickHouseClient } from '@clickhouse/client'
import { CreateEventsTable } from './001CreateEventsTable'
import { CreateEventPropsTable } from './002CreateEventPropsTable'
import { CreateMigrationsTable } from './000CreateMigrationsTable'
import { formatDateForClickHouse } from '../../lib/clickhouse/formatDateTime'
import { CreatePlayerGameStatSnapshotsTable } from './003CreatePlayerGameStatSnapshotsTable'
import { MigrateEventsTimestampsToDate64 } from './004MigrateEventsTimestampsToDate64'
import { CreatePlayerSessionsTable } from './005CreatePlayerSessionsTable'
import { AddEventPropsEventIdIndex } from './006AddEventPropsEventIdIndex'

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
    name: 'CreatePlayerGameStatSnapshotsTable',
    sql: CreatePlayerGameStatSnapshotsTable
  },
  {
    name: 'MigrateEventsTimestampsToDate64',
    sql: MigrateEventsTimestampsToDate64
  },
  {
    name: 'CreatePlayerSessionsTable',
    sql: CreatePlayerSessionsTable
  },
  {
    name: 'AddEventPropsEventIdIndex',
    sql: AddEventPropsEventIdIndex
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
    const queries = migration.sql.split(';').filter((query) => query.trim() !== '')
    for (const query of queries) {
      await clickhouse.query({ query })
    }
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
