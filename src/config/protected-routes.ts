import Koa, { Context, Next } from 'koa'
import { service } from 'koa-rest-services'
import APIKeysService, { apiKeysRoutes } from '../services/api-keys.service'
import EventsService from '../services/events.service'
import GamesService from '../services/games.service'
import HeadlinesService, { headlinesRoutes } from '../services/headlines.service'
import PlayersService from '../services/players.service'
import UsersService, { usersRoutes } from '../services/users.service'

export default (app: Koa) => {
  app.use(async (ctx: Context, next: Next): Promise<void> => {
    if (!ctx.path.match(/^\/(public|v1)\//)) {
      if (ctx.state.user.api) ctx.throw(403)
    }
    await next()
  })

  app.use(service('apiKeys', new APIKeysService(), {
    basePath: '/api-keys',
    routes: apiKeysRoutes
  }))

  app.use(service('events', new EventsService(), {
    basePath: '/events'
  }))

  app.use(service('players', new PlayersService(), {
    basePath: '/players'
  }))

  app.use(service('games', new GamesService(), {
    basePath: '/games'
  }))

  app.use(service('users', new UsersService(), {
    basePath: '/users',
    routes: usersRoutes
  }))

  app.use(service('headlines', new HeadlinesService(), {
    basePath: '/headlines',
    routes: headlinesRoutes
  }))
}
