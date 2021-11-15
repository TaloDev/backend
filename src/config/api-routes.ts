import Koa, { Context, Next } from 'koa'
import { service } from 'koa-rest-services'
import LeaderboardsAPIService from '../services/api/leaderboards-api.service'
import EventsAPIService from '../services/api/events-api.service'
import PlayersAPIService from '../services/api/players-api.service'
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

  app.use(service('/v1/leaderboards', new LeaderboardsAPIService()))
  app.use(service('/v1/events', new EventsAPIService()))
  app.use(service('/v1/players', new PlayersAPIService()))
}
