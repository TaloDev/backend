import Koa, { Context, Next } from 'koa'
import { service, ServiceOpts } from 'koa-clay'
import OrganisationService from '../services/organisation.service'
import InviteService from '../services/invite.service'
import GameStatService from '../services/game-stat.service'
import GameActivityService from '../services/game-activity.service'
import LeaderboardService from '../services/leaderboard.service'
import DataExportService from '../services/data-export.service'
import APIKeyService from '../services/api-key.service'
import EventService from '../services/event.service'
import GameService from '../services/game.service'
import HeadlineService from '../services/headline.service'
import PlayerService from '../services/player.service'
import UserService from '../services/user.service'
import BillingService from '../services/billing.service'

export default (app: Koa) => {
  app.use(async (ctx: Context, next: Next): Promise<void> => {
    // trying to access protected route via api key
    if (!ctx.path.match(/^\/(public|v1)\//)) {
      if (ctx.state.user?.api) ctx.throw(401)
    }
    await next()
  })

  const serviceOpts: ServiceOpts = {
    docs: {
      hidden: true
    }
  }

  app.use(service('/billing', new BillingService(), serviceOpts))
  app.use(service('/organisations', new OrganisationService(), serviceOpts))
  app.use(service('/invites', new InviteService(), serviceOpts))
  app.use(service('/game-stats', new GameStatService(), serviceOpts))
  app.use(service('/game-activities', new GameActivityService(), serviceOpts))
  app.use(service('/leaderboards', new LeaderboardService(), serviceOpts))
  app.use(service('/data-exports', new DataExportService(), serviceOpts))
  app.use(service('/api-keys', new APIKeyService(), serviceOpts))
  app.use(service('/events', new EventService(), serviceOpts))
  app.use(service('/players', new PlayerService(), serviceOpts))
  app.use(service('/games', new GameService(), serviceOpts))
  app.use(service('/users', new UserService(), serviceOpts))
  app.use(service('/headlines', new HeadlineService(), serviceOpts))
}
