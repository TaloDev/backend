import Koa from 'koa'
import { documentationRouter } from '../routes/public/documentation/index.js'
import { healthCheckRouter } from '../routes/public/health-check/index.js'
import { invitePublicRouter } from '../routes/public/invite-public/index.js'
import { playerPublicRouter } from '../routes/public/player-public/index.js'
import { userPublicRouter } from '../routes/public/user-public/index.js'
import { webhookRouter } from '../routes/public/webhook/index.js'

export function configurePublicRoutes(app: Koa) {
  app.use(documentationRouter().routes())
  app.use(healthCheckRouter().routes())
  app.use(invitePublicRouter().routes())
  app.use(playerPublicRouter().routes())
  app.use(userPublicRouter().routes())
  app.use(webhookRouter().routes())
}
