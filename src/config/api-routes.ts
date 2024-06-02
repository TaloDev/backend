import Koa, { Context, Next } from 'koa'
import { service } from 'koa-clay'
import GameConfigAPIService from '../services/api/game-config-api.service.js'
import GameStatAPIService from '../services/api/game-stat-api.service.js'
import GameSaveAPIService from '../services/api/game-save-api.service.js'
import LeaderboardAPIService from '../services/api/leaderboard-api.service.js'
import EventAPIService from '../services/api/event-api.service.js'
import PlayerAPIService from '../services/api/player-api.service.js'
import limiterMiddleware from '../middlewares/limiter-middleware.js'
import currentPlayerMiddleware from '../middlewares/current-player-middleware.js'
import { apiRouteAuthMiddleware, getRouteInfo } from '../middlewares/route-middleware.js'
import apiKeyMiddleware from '../middlewares/api-key-middleware.js'

export default (app: Koa) => {
  app.use(apiKeyMiddleware)
  app.use(apiRouteAuthMiddleware)
  app.use(limiterMiddleware)

  app.use(async (ctx: Context, next: Next): Promise<void> => {
    const route = getRouteInfo(ctx)
    if (route.isAPIRoute && !route.isAPICall) ctx.throw(401)
    await next()
  })

  app.use(currentPlayerMiddleware)

  app.use(service('/v1/game-config', new GameConfigAPIService()))
  app.use(service('/v1/game-stats', new GameStatAPIService()))
  app.use(service('/v1/game-saves', new GameSaveAPIService()))
  app.use(service('/v1/leaderboards', new LeaderboardAPIService()))
  app.use(service('/v1/events', new EventAPIService()))
  app.use(service('/v1/players', new PlayerAPIService()))
}
