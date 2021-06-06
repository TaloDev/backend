import Koa, { Context, Next } from 'koa'
import { service } from 'koa-rest-services'
import EventsAPIService from '../services/api/events-api.service'
import PlayersAPIService from '../services/api/players-api.service'
import limiterMiddleware from './limiter-middleware'

export default (app: Koa) => {
  app.use(async (ctx: Context, next: Next): Promise<void> => {
    if (ctx.path.match(/^\/(v1)\//)) {
      if (ctx.state.user?.api !== true) ctx.throw(403)
    }
    await next()
  })

  if (process.env.NODE_ENV !== 'test') {
    app.use(limiterMiddleware)
  }
  
  app.use(service('events-api', new EventsAPIService(), {
    prefix: '/v1/events'
  }))

  app.use(service('players-api', new PlayersAPIService(), {
    prefix: '/v1/players'
  }))
}
