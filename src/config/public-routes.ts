import Koa from 'koa'
import Router from 'koa-tree-router'
import { documentationRouter } from '../routes/public/documentation/index.js'
import { healthCheckRouter } from '../routes/public/health-check/index.js'
import { invitePublicRouter } from '../routes/public/invite-public/index.js'
import { playerPublicRouter } from '../routes/public/player-public/index.js'
import { userPublicRouter } from '../routes/public/user-public/index.js'
import { webhookRouter } from '../routes/public/webhook/index.js'

export function configurePublicRoutes(app: Koa) {
  const router = new Router()

  documentationRouter(router)
  healthCheckRouter(router)
  invitePublicRouter(router)
  playerPublicRouter(router)
  userPublicRouter(router)
  webhookRouter(router)
  app.use(router.routes())
}
