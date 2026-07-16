import Koa from 'koa'
import Router from 'koa-tree-router'
import { adminAPIKeyMiddleware } from '../middleware/admin-api-key-middleware.js'
import { gameStatAdminRouter } from '../routes/admin/game-stat/index.js'

export function configureAdminAPIRoutes(app: Koa) {
  app.use(adminAPIKeyMiddleware)

  const mainRouter = new Router()

  gameStatAdminRouter(mainRouter)

  app.use(mainRouter.routes())
}
