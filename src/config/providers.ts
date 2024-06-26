import Koa from 'koa'
import SendGrid from '@sendgrid/mail'
import * as Sentry from '@sentry/node'
import ormConfig from './mikro-orm.config'
import { MikroORM } from '@mikro-orm/mysql'
import tracingMiddleware from '../middlewares/tracing-middleware'

const initProviders = async (app: Koa) => {
  try {
    const orm = await MikroORM.init(ormConfig)
    app.context.em = orm.em

    if (!app.context.isTest) {
      const migrator = orm.getMigrator()
      await migrator.up()
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }

  SendGrid.setApiKey(process.env.SENDGRID_KEY)

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENV,
    tracesSampleRate: 0.2,
    integrations: [
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations()
    ]
  })

  app.use(tracingMiddleware)
}

export default initProviders
