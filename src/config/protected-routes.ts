import Koa, { Context, Next } from 'koa'
import { service, ServiceOpts } from 'koa-clay'
import PlayerGroupService from '../services/player-group.service.js'
import OrganisationService from '../services/organisation.service.js'
import InviteService from '../services/invite.service.js'
import GameStatService from '../services/game-stat.service.js'
import GameActivityService from '../services/game-activity.service.js'
import LeaderboardService from '../services/leaderboard.service.js'
import DataExportService from '../services/data-export.service.js'
import APIKeyService from '../services/api-key.service.js'
import EventService from '../services/event.service.js'
import GameService from '../services/game.service.js'
import HeadlineService from '../services/headline.service.js'
import PlayerService from '../services/player.service.js'
import UserService from '../services/user.service.js'
import BillingService from '../services/billing.service.js'
import IntegrationService from '../services/integration.service.js'
import { getRouteInfo, protectedRouteAuthMiddleware } from '../middlewares/route-middleware.js'

export default (app: Koa) => {
  app.use(protectedRouteAuthMiddleware)

  app.use(async (ctx: Context, next: Next): Promise<void> => {
    const route = getRouteInfo(ctx)
    if (route.isProtectedRoute && route.isAPICall) ctx.throw(401)
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
  app.use(service('/games/:gameId/game-stats', new GameStatService(), serviceOpts))
  app.use(service('/games/:gameId/game-activities', new GameActivityService(), serviceOpts))
  app.use(service('/games/:gameId/leaderboards', new LeaderboardService(), serviceOpts))
  app.use(service('/games/:gameId/data-exports', new DataExportService(), serviceOpts))
  app.use(service('/games/:gameId/api-keys', new APIKeyService(), serviceOpts))
  app.use(service('/games/:gameId/events', new EventService(), serviceOpts))
  app.use(service('/games/:gameId/players', new PlayerService(), serviceOpts))
  app.use(service('/games/:gameId/headlines', new HeadlineService(), serviceOpts))
  app.use(service('/games/:gameId/integrations', new IntegrationService(), serviceOpts))
  app.use(service('/games/:gameId/player-groups', new PlayerGroupService(), serviceOpts))
  app.use(service('/games', new GameService(), serviceOpts))
  app.use(service('/users', new UserService(), serviceOpts))
}
