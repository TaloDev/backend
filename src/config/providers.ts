import type { EntityManager } from '@mikro-orm/mysql'
import { setupKoaErrorHandler as setupSentryErrorHandler } from '@sentry/node'
import Koa from 'koa'
import createClickHouseClient from '../lib/clickhouse/createClient.js'
import { runClickHouseMigrations } from '../migrations/clickhouse/index.js'
import { setupGlobalQueues } from './global-queues.js'
import { getMikroORM } from './mikro-orm.config.js'
import { getGlobalRedis } from './redis.config.js'
import { initScheduledTasks } from './scheduled-tasks.js'

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

  app.context.redis = getGlobalRedis()
  setupGlobalQueues()

  if (!isTest) {
    await initScheduledTasks()
  }

  app.context.clickhouse = createClickHouseClient()
  if (!isTest) {
    await runClickHouseMigrations(app.context.clickhouse)
  }

  if (!isTest) {
    setupSentryErrorHandler(app)
  }
}
