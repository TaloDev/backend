import Koa from 'koa'
import { service } from 'koa-clay'
import GameChannelAPIService from '../services/api/game-channel-api.service'
import HealthCheckAPIService from '../services/api/health-check-api.service'
import GameFeedbackAPIService from '../services/api/game-feedback-api.service'
import GameConfigAPIService from '../services/api/game-config-api.service'
import GameStatAPIService from '../services/api/game-stat-api.service'
import GameSaveAPIService from '../services/api/game-save-api.service'
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
import PlayerGroupAPIService from '../services/api/player-group-api.service'
import SocketTicketAPIService from '../services/api/socket-ticket-api.service'
import PlayerPresenceAPIService from '../services/api/player-presence-api.service'

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

  app.use(service('/v1/socket-tickets', new SocketTicketAPIService()))
  app.use(service('/v1/game-channels', new GameChannelAPIService()))
  app.use(service('/v1/player-groups', new PlayerGroupAPIService()))
  app.use(service('/v1/health-check', new HealthCheckAPIService()))
  app.use(service('/v1/game-feedback', new GameFeedbackAPIService()))
  app.use(service('/v1/game-config', new GameConfigAPIService()))
  app.use(service('/v1/game-stats', new GameStatAPIService()))
  app.use(service('/v1/game-saves', new GameSaveAPIService()))
  app.use(service('/v1/leaderboards', new LeaderboardAPIService()))
  app.use(service('/v1/events', new EventAPIService()))
  app.use(service('/v1/players', new PlayerAPIService()))
  app.use(service('/v1/players/auth', new PlayerAuthAPIService()))
  app.use(service('/v1/players/presence', new PlayerPresenceAPIService()))
}
