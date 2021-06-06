import Koa, { Context, Next } from 'koa'
import { service } from 'koa-rest-services'
import APIKeysService from '../services/api-keys.service'
import EventsService from '../services/events.service'
import GamesService from '../services/games.service'
import HeadlinesService from '../services/headlines.service'
import PlayersService from '../services/players.service'
import UsersService from '../services/users.service'

export default (app: Koa) => {
  app.use(async (ctx: Context, next: Next): Promise<void> => {
    if (!ctx.path.match(/^\/(public|v1)\//)) {
      if (ctx.state.user?.api) ctx.throw(403)
    }
    await next()
  })

  app.use(service('apiKeys', new APIKeysService(), {
    prefix: '/api-keys'
  }))

  app.use(service('events', new EventsService(), {
    prefix: '/events'
  }))

  app.use(service('players', new PlayersService(), {
    prefix: '/players'
  }))

  app.use(service('games', new GamesService(), {
    prefix: '/games'
  }))

  app.use(service('users', new UsersService(), {
    prefix: '/users'
  }))

  app.use(service('headlines', new HeadlinesService(), {
    prefix: '/headlines'
  }))
}
