import Koa from 'koa'
import Router from 'koa-tree-router'
import { adminAPIKeyMiddleware } from '../middleware/admin-api-key-middleware.js'
import { gameConfigAdminRouter } from '../routes/admin/game-config/index.js'
import { gameStatAdminRouter } from '../routes/admin/game-stat/index.js'
import { leaderboardAdminRouter } from '../routes/admin/leaderboard/index.js'
import { playerAdminRouter } from '../routes/admin/player/index.js'

export function configureAdminAPIRoutes(app: Koa) {
  app.use(adminAPIKeyMiddleware)

  const mainRouter = new Router()

  gameConfigAdminRouter(mainRouter)
  gameStatAdminRouter(mainRouter)
  leaderboardAdminRouter(mainRouter)
  playerAdminRouter(mainRouter)

  app.use(mainRouter.routes())
}
