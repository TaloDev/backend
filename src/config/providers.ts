import Koa from 'koa'
import type { EntityManager } from '@mikro-orm/mysql'
import { getMikroORM } from './mikro-orm.config'
import createClickHouseClient from '../lib/clickhouse/createClient'
import { runClickHouseMigrations } from '../migrations/clickhouse'
import { initScheduledTasks } from './scheduled-tasks'
import { setupKoaErrorHandler as setupSentryErrorHandler } from '@sentry/node'
import { createRedisConnection } from './redis.config'
import { setupGlobalQueues } from './global-queues'

export async function initProviders(app: Koa, isTest: boolean) {
  try {
    const orm = await getMikroORM()
    app.context.em = orm.em as EntityManager

    if (!isTest) {
      const migrator = orm.migrator
      await migrator.up()
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }

  app.context.redis = createRedisConnection()
  setupGlobalQueues()

  if (!isTest) {
    await initScheduledTasks()
  }

  app.context.clickhouse = createClickHouseClient()
  if (!isTest) {
    await runClickHouseMigrations(app.context.clickhouse)
  }

  setupSentryErrorHandler(app)
}
