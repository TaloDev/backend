import Koa from 'koa'
import { service } from 'koa-clay'
import GameChannelAPIService from '../services/api/game-channel-api.service'
import { gameFeedbackAPIRouter } from '../routes/api/game-feedback'
import { gameConfigAPIRouter } from '../routes/api/game-config'
import { healthCheckAPIRouter } from '../routes/api/health-check'
import { socketTicketAPIRouter } from '../routes/api/socket-ticket'
import GameStatAPIService from '../services/api/game-stat-api.service'
import { gameSaveAPIRouter } from '../routes/api/game-save'
import LeaderboardAPIService from '../services/api/leaderboard-api.service'
import EventAPIService from '../services/api/event-api.service'
import PlayerAPIService from '../services/api/player-api.service'
import limiterMiddleware from '../middleware/limiter-middleware'
import currentPlayerMiddleware from '../middleware/current-player-middleware'
import { apiRouteAuthMiddleware, getRouteInfo } from '../middleware/route-middleware'
import apiKeyMiddleware from '../middleware/api-key-middleware'
import playerAuthMiddleware from '../middleware/player-auth-middleware'
import PlayerAuthAPIService from '../services/api/player-auth-api.service'
import continunityMiddleware from '../middleware/continunity-middleware'
import { playerGroupAPIRouter } from '../routes/api/player-group'
import { playerPresenceAPIRouter } from '../routes/api/player-presence'
import PlayerRelationshipsAPIService from '../services/api/player-relationships-api.service'

export default function configureAPIRoutes(app: Koa) {
  app.use(apiKeyMiddleware)
  app.use(apiRouteAuthMiddleware)
  app.use(limiterMiddleware)

  app.use(async function apiRouteMiddleware(ctx, next) {
    const route = getRouteInfo(ctx)
    if (route.isAPIRoute && !route.isAPICall) ctx.throw(401)
    await next()
  })

  app.use(currentPlayerMiddleware)
  app.use(playerAuthMiddleware)
  app.use(continunityMiddleware)

  app.use(service('/v1/game-channels', new GameChannelAPIService()))
  app.use(service('/v1/game-stats', new GameStatAPIService()))
  app.use(service('/v1/leaderboards', new LeaderboardAPIService()))
  app.use(service('/v1/events', new EventAPIService()))
  app.use(service('/v1/players/auth', new PlayerAuthAPIService()))
  app.use(service('/v1/players/relationships', new PlayerRelationshipsAPIService()))
  app.use(service('/v1/players', new PlayerAPIService()))

  app.use(gameConfigAPIRouter().routes())
  app.use(gameFeedbackAPIRouter().routes())
  app.use(gameSaveAPIRouter().routes())
  app.use(healthCheckAPIRouter().routes())
  app.use(playerGroupAPIRouter().routes())
  app.use(playerPresenceAPIRouter().routes())
  app.use(socketTicketAPIRouter().routes())
}
