import Koa from 'koa'
import ormConfig from './mikro-orm.config'
import { MikroORM } from '@mikro-orm/mysql'
import createEmailQueue from '../lib/queues/createEmailQueue'
import createClickHouseClient from '../lib/clickhouse/createClient'
import { runClickHouseMigrations } from '../migrations/clickhouse'
import initScheduledTasks from './scheduled-tasks'
import { setupKoaErrorHandler as setupSentryErrorHandler } from '@sentry/node'
import { createRedisConnection } from './redis.config'

export default async function initProviders(app: Koa, isTest: boolean) {
  try {
    const orm = await MikroORM.init(ormConfig)
    app.context.em = orm.em

    if (!isTest) {
      const migrator = orm.getMigrator()
      await migrator.up()
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }

  app.context.redis = createRedisConnection()

  app.context.emailQueue = createEmailQueue()

  if (!isTest) {
    await initScheduledTasks()
  }

  app.context.clickhouse = createClickHouseClient()
  if (!isTest) {
    await runClickHouseMigrations(app.context.clickhouse)
  }

  setupSentryErrorHandler(app)
}
