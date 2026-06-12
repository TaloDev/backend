import Koa from 'koa'
import Router from 'koa-tree-router'
import { apiKeyMiddleware } from '../middleware/api-key-middleware.js'
import { apiRouteAuthMiddleware } from '../middleware/api-route-middleware.js'
import { continuityMiddleware } from '../middleware/continuity-middleware.js'
import { currentPlayerMiddleware } from '../middleware/current-player-middleware.js'
import { playerAuthMiddleware } from '../middleware/player-auth-middleware.js'
import { signatureMiddleware } from '../middleware/signature-middleware.js'
import { eventAPIRouter } from '../routes/api/event/index.js'
import { gameChannelAPIRouter } from '../routes/api/game-channel/index.js'
import { gameConfigAPIRouter } from '../routes/api/game-config/index.js'
import { gameFeedbackAPIRouter } from '../routes/api/game-feedback/index.js'
import { gameSaveAPIRouter } from '../routes/api/game-save/index.js'
import { gameStatAPIRouter } from '../routes/api/game-stat/index.js'
import { healthCheckAPIRouter } from '../routes/api/health-check/index.js'
import { leaderboardAPIRouter } from '../routes/api/leaderboard/index.js'
import { playerAuthAPIRouter } from '../routes/api/player-auth/index.js'
import { playerGroupAPIRouter } from '../routes/api/player-group/index.js'
import { playerPresenceAPIRouter } from '../routes/api/player-presence/index.js'
import { playerRelationshipAPIRouter } from '../routes/api/player-relationship/index.js'
import { playerAPIRouter } from '../routes/api/player/index.js'
import { socketTicketAPIRouter } from '../routes/api/socket-ticket/index.js'

export function configureAPIRoutes(app: Koa) {
  app.use(apiKeyMiddleware)
  app.use(apiRouteAuthMiddleware)

  app.use(currentPlayerMiddleware)
  app.use(playerAuthMiddleware)
  app.use(signatureMiddleware)
  app.use(continuityMiddleware)

  const mainRouter = new Router()
  const playerParamRouter = new Router()
  const gameChannelParamRouter = new Router()
  const gameStatParamRouter = new Router()

  eventAPIRouter(mainRouter)
  gameConfigAPIRouter(mainRouter)
  gameFeedbackAPIRouter(mainRouter)
  gameSaveAPIRouter(mainRouter)
  healthCheckAPIRouter(mainRouter)
  leaderboardAPIRouter(mainRouter)
  playerAuthAPIRouter(mainRouter)
  playerGroupAPIRouter(mainRouter)
  playerPresenceAPIRouter(mainRouter)
  playerRelationshipAPIRouter(mainRouter)
  socketTicketAPIRouter(mainRouter)

  // these have static + parameterized routes
  playerAPIRouter(mainRouter, playerParamRouter)
  gameChannelAPIRouter(mainRouter, gameChannelParamRouter)
  gameStatAPIRouter(mainRouter, gameStatParamRouter)

  app.use(mainRouter.routes())
  app.use(playerParamRouter.routes())
  app.use(gameChannelParamRouter.routes())
  app.use(gameStatParamRouter.routes())
}
