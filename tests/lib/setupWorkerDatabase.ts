import mysql, { RowDataPacket } from 'mysql2/promise'
import { createClient } from '@clickhouse/client'
import { WorkerDatabaseConfig } from './getWorkerConfig'
import { getMikroORM } from '../../src/config/mikro-orm.config'
import { runClickHouseMigrations } from '../../src/migrations/clickhouse'

export async function setupMySQLDatabase(config: WorkerDatabaseConfig): Promise<void> {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS
  })

  // Check if database already exists
  const [databases] = await connection.execute<RowDataPacket[]>(
    'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
    [config.mysqlDatabase]
  )
  const dbExists = databases.length > 0
  await connection.end()

  // Only create and migrate if database doesn't exist
  if (!dbExists) {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASS
    })
    await conn.execute(`CREATE DATABASE ${config.mysqlDatabase}`)
    await conn.end()

    const orm = await getMikroORM()
    const migrator = orm.migrator
    await migrator.up()
  }
}

export async function setupClickHouseDatabase(config: WorkerDatabaseConfig) {
  const setupClient = createClient({
    url: `http://${process.env.CLICKHOUSE_USER}:${process.env.CLICKHOUSE_PASSWORD}@${process.env.CLICKHOUSE_HOST}:${process.env.CLICKHOUSE_PORT}/default`
  })

  // Check if database already exists
  const result = await setupClient.query({
    query: `SELECT name FROM system.databases WHERE name = '${config.clickhouseDatabase}'`,
    format: 'JSONEachRow'
  })
  const rows = await result.json<{ name: string }>()
  const dbExists = rows.length > 0

  // Only create and migrate if database doesn't exist
  if (!dbExists) {
    await setupClient.command({
      query: `CREATE DATABASE ${config.clickhouseDatabase}`
    })
    await setupClient.close()

    const workerClient = createClient({
      url: `http://${process.env.CLICKHOUSE_USER}:${process.env.CLICKHOUSE_PASSWORD}@${process.env.CLICKHOUSE_HOST}:${process.env.CLICKHOUSE_PORT}/${config.clickhouseDatabase}`
    })
    await runClickHouseMigrations(workerClient)
    await workerClient.close()
  } else {
    await setupClient.close()
  }
}

export async function teardownWorkerDatabase(config: WorkerDatabaseConfig) {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS
  })
  await connection.execute(`DROP DATABASE IF EXISTS ${config.mysqlDatabase}`)
  await connection.end()

  const clickhouse = createClient({
    url: `http://${process.env.CLICKHOUSE_USER}:${process.env.CLICKHOUSE_PASSWORD}@${process.env.CLICKHOUSE_HOST}:${process.env.CLICKHOUSE_PORT}/default`
  })
  await clickhouse.command({
    query: `DROP DATABASE IF EXISTS ${config.clickhouseDatabase}`
  })
  await clickhouse.close()
}
