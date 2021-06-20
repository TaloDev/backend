import Koa from 'koa'
import SendGrid from '@sendgrid/mail'
import * as Sentry from '@sentry/node'

const initProviders = (app: Koa) => {
  SendGrid.setApiKey(process.env.SENDGRID_KEY)

  Sentry.init({ dsn: process.env.SENTRY_DSN })
}

export default initProviders
