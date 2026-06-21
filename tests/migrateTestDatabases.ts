import { MikroORM } from '@mikro-orm/mysql'
import ormConfig from '../src/config/mikro-orm.config.js'
import createClickHouseClient from '../src/lib/clickhouse/createClient.js'
import { runClickHouseMigrations } from '../src/migrations/clickhouse/index.js'
import vitestConfig from '../vitest.config.mjs'

async function migrateTestDatabases() {
  const workerCount = Number(vitestConfig.test?.maxWorkers ?? 1)

  console.time('Migrating databases')

  await Promise.all(
    Array.from({ length: workerCount }, (_, i) => {
      const poolId = String(i + 1)

      return Promise.all([migrateMikroORM(poolId, i), migrateClickHouse(poolId, i)])
    }),
  )

  console.timeEnd('Migrating databases')

  process.exit(0)
}

async function migrateMikroORM(poolId: string, currentWorker: number) {
  console.time(`Migrating MikroORM ${currentWorker + 1}`)

  const dbName = `${process.env.DB_NAME}_${poolId}`

  const orm = await MikroORM.init({
    ...ormConfig,
    dbName,
    migrations: {
      ...ormConfig.migrations,
      silent: true,
    },
  })
  await orm.migrator.up()
  await orm.close()

  console.timeEnd(`Migrating MikroORM ${currentWorker + 1}`)
}

async function migrateClickHouse(poolId: string, currentWorker: number) {
  console.time(`Migrating ClickHouse ${currentWorker + 1}`)

  const dbName = `${process.env.CLICKHOUSE_DB}_${poolId}`

  const creationClient = createClickHouseClient({ connectToDb: false })
  await creationClient.command({
    query: `CREATE DATABASE ${dbName}`,
  })
  await creationClient.close()

  const clickhouse = createClickHouseClient({ dbName })
  await runClickHouseMigrations(clickhouse, false)
  await clickhouse.close()

  console.timeEnd(`Migrating ClickHouse ${currentWorker + 1}`)
}

void migrateTestDatabases()
