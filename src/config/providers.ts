import Koa from 'koa'
import SendGrid from '@sendgrid/mail'
import * as Sentry from '@sentry/node'
import ormConfig from './mikro-orm.config'
import { MikroORM } from '@mikro-orm/mysql'
import tracingMiddleware from '../middlewares/tracing-middleware'
import createEmailQueue from '../lib/queues/createEmailQueue'
import createClickhouseClient from '../lib/clickhouse/createClient'
import { runClickhouseMigrations } from '../migrations/clickhouse'
import initScheduledTasks from './scheduled-tasks'

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

  if (process.env.SENDGRID_KEY) {
    SendGrid.setApiKey(process.env.SENDGRID_KEY)
  }

  app.context.emailQueue = createEmailQueue()

  if (!isTest) {
    await initScheduledTasks()
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENV,
    tracesSampleRate: 0.2,
    maxValueLength: 4096,
    integrations: [
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations()
    ]
  })

  app.context.clickhouse = createClickhouseClient()
  if (!isTest) {
    await runClickhouseMigrations(app.context.clickhouse)
  }

  app.use(tracingMiddleware)
}
