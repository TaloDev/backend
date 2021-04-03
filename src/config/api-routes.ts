import Koa, { Context, Next } from 'koa'
import { service } from 'koa-rest-services'
import EventsAPIService from '../services/api/events-api.service'
import PlayersAPIService, { playersAPIRoutes } from '../services/api/players-api.service'

export default (app: Koa) => {
  app.use(async (ctx: Context, next: Next): Promise<void> => {
    if (ctx.path.match(/^\/(api)\//)) {
      if (ctx.state.user.api !== true) ctx.throw(403)
    }
    await next()
  })
  
  app.use(service('events-api', new EventsAPIService(), {
    basePath: '/api/events'
  }))

  app.use(service('players-api', new PlayersAPIService(), {
    basePath: '/api/players',
    routes: playersAPIRoutes
  }))
}
