import Koa, { Context, Next } from 'koa'
import { service } from 'koa-rest-services'
import GameActivitiesService from '../services/game-activities.service'
import LeaderboardsService from '../services/leaderboards.service'
import DataExportsService from '../services/data-exports.service'
import APIKeysService from '../services/api-keys.service'
import EventsService from '../services/events.service'
import GamesService from '../services/games.service'
import HeadlinesService from '../services/headlines.service'
import PlayersService from '../services/players.service'
import UsersService from '../services/users.service'

export default (app: Koa) => {
  app.use(async (ctx: Context, next: Next): Promise<void> => {
    if (!ctx.path.match(/^\/(public|v1)\//)) {
      if (ctx.state.user?.api) ctx.throw(401)
    }
    await next()
  })

  app.use(service('/game-activities', new GameActivitiesService()))
  app.use(service('/leaderboards', new LeaderboardsService()))
  app.use(service('/data-exports', new DataExportsService()))
  app.use(service('/api-keys', new APIKeysService()))
  app.use(service('/events', new EventsService()))
  app.use(service('/players', new PlayersService()))
  app.use(service('/games', new GamesService()))
  app.use(service('/users', new UsersService()))
  app.use(service('/headlines', new HeadlinesService()))
}
