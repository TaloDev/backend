import Koa, { Context, Next } from 'koa'
import { service } from 'koa-clay'
import GameActivitieService from '../services/game-activities.service'
import LeaderboardService from '../services/leaderboards.service'
import DataExportService from '../services/data-exports.service'
import APIKeyService from '../services/api-keys.service'
import EventService from '../services/events.service'
import GameService from '../services/games.service'
import HeadlineService from '../services/headlines.service'
import PlayerService from '../services/players.service'
import UserService from '../services/users.service'

export default (app: Koa) => {
  app.use(async (ctx: Context, next: Next): Promise<void> => {
    if (!ctx.path.match(/^\/(public|v1)\//)) {
      if (ctx.state.user?.api) ctx.throw(401)
    }
    await next()
  })

  app.use(service('/game-activities', new GameActivitieService()))
  app.use(service('/leaderboards', new LeaderboardService()))
  app.use(service('/data-exports', new DataExportService()))
  app.use(service('/api-keys', new APIKeyService()))
  app.use(service('/events', new EventService()))
  app.use(service('/players', new PlayerService()))
  app.use(service('/games', new GameService()))
  app.use(service('/users', new UserService()))
  app.use(service('/headlines', new HeadlineService()))
}
