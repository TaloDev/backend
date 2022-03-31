import Koa, { Context, Next } from 'koa'
import { service } from 'koa-clay'
import GameStatAPIService from '../services/api/game-stat-api.service'
import GameSaveAPIService from '../services/api/game-save-api.service'
import LeaderboardAPIService from '../services/api/leaderboard-api.service'
import EventAPIService from '../services/api/event-api.service'
import PlayerAPIService from '../services/api/player-api.service'
import limiterMiddleware from './limiter-middleware'

export default (app: Koa) => {
  app.use(async (ctx: Context, next: Next): Promise<void> => {
    if (ctx.path.match(/^\/(v1)\//)) {
      if (ctx.state.user?.api !== true) ctx.throw(401)
    }
    await next()
  })

  if (process.env.NODE_ENV !== 'test') {
    app.use(limiterMiddleware)
  }

  app.use(service('/v1/game-stats', new GameStatAPIService()))
  app.use(service('/v1/game-saves', new GameSaveAPIService()))
  app.use(service('/v1/leaderboards', new LeaderboardAPIService()))
  app.use(service('/v1/events', new EventAPIService()))
  app.use(service('/v1/players', new PlayerAPIService()))
}
