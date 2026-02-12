import Koa from 'koa'
import { gameFeedbackAPIRouter } from '../routes/api/game-feedback'
import { gameConfigAPIRouter } from '../routes/api/game-config'
import { healthCheckAPIRouter } from '../routes/api/health-check'
import { socketTicketAPIRouter } from '../routes/api/socket-ticket'
import { gameStatAPIRouter } from '../routes/api/game-stat'
import { gameSaveAPIRouter } from '../routes/api/game-save'
import { leaderboardAPIRouter } from '../routes/api/leaderboard'
import { eventAPIRouter } from '../routes/api/event'
import { playerAPIRouter } from '../routes/api/player'
import { limiterMiddleware } from '../middleware/limiter-middleware'
import { currentPlayerMiddleware } from '../middleware/current-player-middleware'
import { apiRouteAuthMiddleware } from '../middleware/api-route-middleware'
import { apiKeyMiddleware } from '../middleware/api-key-middleware'
import { playerAuthMiddleware } from '../middleware/player-auth-middleware'
import { continuityMiddleware } from '../middleware/continuity-middleware'
import { playerGroupAPIRouter } from '../routes/api/player-group'
import { playerPresenceAPIRouter } from '../routes/api/player-presence'
import { playerRelationshipAPIRouter } from '../routes/api/player-relationship'
import { gameChannelAPIRouter } from '../routes/api/game-channel'
import { playerAuthAPIRouter } from '../routes/api/player-auth'

export function configureAPIRoutes(app: Koa) {
  app.use(apiKeyMiddleware)
  app.use(apiRouteAuthMiddleware)
  app.use(limiterMiddleware)

  app.use(currentPlayerMiddleware)
  app.use(playerAuthMiddleware)
  app.use(continuityMiddleware)

  app.use(eventAPIRouter().routes())
  app.use(gameChannelAPIRouter().routes())
  app.use(leaderboardAPIRouter().routes())
  app.use(gameConfigAPIRouter().routes())
  app.use(gameFeedbackAPIRouter().routes())
  app.use(gameSaveAPIRouter().routes())
  app.use(gameStatAPIRouter().routes())
  app.use(healthCheckAPIRouter().routes())
  app.use(playerAPIRouter().routes())
  app.use(playerAuthAPIRouter().routes())
  app.use(playerGroupAPIRouter().routes())
  app.use(playerPresenceAPIRouter().routes())
  app.use(playerRelationshipAPIRouter().routes())
  app.use(socketTicketAPIRouter().routes())
}
