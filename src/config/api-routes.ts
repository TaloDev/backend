import Koa, { Context, Next } from 'koa'
import { service } from 'koa-rest-services'
import EventsAPIService from '../services/api/events-api.service'
import PlayersAPIService, { playerAPIRoutes } from '../services/api/players-api.service'

export default (app: Koa) => {
  app.use(async (ctx: Context, next: Next): Promise<void> => {
    if (ctx.path.match(/^\/(api)\//)) {
      if (!Array.isArray(ctx.state.user.scopes)) ctx.throw(403)
      ctx.state.user.api = true
    }
    await next()
  })
  
  app.use(service('events-api', new EventsAPIService('events'), {
    basePath: '/api/events'
  }))

  app.use(service('players-api', new PlayersAPIService('players'), {
    basePath: '/api/players',
    routes: playerAPIRoutes
  }))
}
