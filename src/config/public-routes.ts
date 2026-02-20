import Koa from 'koa'
import { demoRouter } from '../routes/public/demo'
import { documentationRouter } from '../routes/public/documentation'
import { healthCheckRouter } from '../routes/public/health-check'
import { invitePublicRouter } from '../routes/public/invite-public'
import { userPublicRouter } from '../routes/public/user-public'
import { webhookRouter } from '../routes/public/webhook'

export function configurePublicRoutes(app: Koa) {
  app.use(documentationRouter().routes())
  app.use(healthCheckRouter().routes())
  app.use(userPublicRouter().routes())
  app.use(demoRouter().routes())
  app.use(invitePublicRouter().routes())
  app.use(webhookRouter().routes())
}
