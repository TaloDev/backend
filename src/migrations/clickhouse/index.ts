import { ClickHouseClient } from '@clickhouse/client'
import { formatDateForClickHouse } from '../../lib/clickhouse/formatDateTime.js'
import { CreateMigrationsTable } from './000CreateMigrationsTable.js'
import { CreateEventsTable } from './001CreateEventsTable.js'
import { CreateEventPropsTable } from './002CreateEventPropsTable.js'
import { CreatePlayerGameStatSnapshotsTable } from './003CreatePlayerGameStatSnapshotsTable.js'
import { MigrateEventsTimestampsToDate64 } from './004MigrateEventsTimestampsToDate64.js'
import { CreatePlayerSessionsTable } from './005CreatePlayerSessionsTable.js'
import { AddEventPropsEventIdIndex } from './006AddEventPropsEventIdIndex.js'
import { AddDevBuildToPlayerGameStatSnapshots } from './007AddDevBuildToPlayerGameStatSnapshots.js'
import { ReorderEventsSortKey } from './008ReorderEventsSortKey.js'
import { AddGameIdToEventProps } from './009AddGameIdToEventProps.js'

type ClickHouseMigration = {
  name: string
  sql: string
}

const migrations: ClickHouseMigration[] = [
  {
    name: 'CreateEventsTable',
    sql: CreateEventsTable,
  },
  {
    name: 'CreateEventPropsTable',
    sql: CreateEventPropsTable,
  },
  {
    name: 'CreatePlayerGameStatSnapshotsTable',
    sql: CreatePlayerGameStatSnapshotsTable,
  },
  {
    name: 'MigrateEventsTimestampsToDate64',
    sql: MigrateEventsTimestampsToDate64,
  },
  {
    name: 'CreatePlayerSessionsTable',
    sql: CreatePlayerSessionsTable,
  },
  {
    name: 'AddEventPropsEventIdIndex',
    sql: AddEventPropsEventIdIndex,
  },
  {
    name: 'AddDevBuildToPlayerGameStatSnapshots',
    sql: AddDevBuildToPlayerGameStatSnapshots,
  },
  {
    name: 'ReorderEventsSortKey',
    sql: ReorderEventsSortKey,
  },
  {
    name: 'AddGameIdToEventProps',
    sql: AddGameIdToEventProps,
  },
]

export async function runClickHouseMigrations(clickhouse: ClickHouseClient, logMigrations = true) {
  if (logMigrations) {
    console.info('Running ClickHouse migrations...')
  }

  await clickhouse.command({ query: CreateMigrationsTable })

  const completedMigrations = await clickhouse
    .query({
      query: 'SELECT name FROM migrations',
      format: 'JSONEachRow',
    })
    .then((res) => res.json<{ name: string }>())

  const pendingMigrations = migrations.filter((migration) => {
    return !completedMigrations.map((row) => row.name).includes(migration.name)
  })

  for (const migration of pendingMigrations) {
    if (logMigrations) {
      console.info(`Processing '${migration.name}'`)
    }

    const queries = migration.sql.split(';').filter((query) => query.trim() !== '')
    for (const query of queries) {
      await clickhouse.command({ query })
    }
    await clickhouse.insert({
      table: 'migrations',
      values: [
        {
          name: migration.name,
          executed_at: formatDateForClickHouse(new Date(), false),
        },
      ],
      format: 'JSONEachRow',
    })

    if (logMigrations) {
      console.info(`Applied '${migration.name}'`)
    }
  }

  if (logMigrations) {
    console.info('ClickHouse up to date!')
  }
}
