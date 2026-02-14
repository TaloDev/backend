import Koa from 'koa'
import { healthCheckRouter } from '../routes/public/health-check'
import { userPublicRouter } from '../routes/public/user-public'
import { demoRouter } from '../routes/public/demo'
import { invitePublicRouter } from '../routes/public/invite-public'
import { webhookRouter } from '../routes/public/webhook'
import { documentationRouter } from '../routes/public/documentation'

export function configurePublicRoutes(app: Koa) {
  app.use(documentationRouter().routes())
  app.use(healthCheckRouter().routes())
  app.use(userPublicRouter().routes())
  app.use(demoRouter().routes())
  app.use(invitePublicRouter().routes())
  app.use(webhookRouter().routes())
}
