import Koa from 'koa'
import { service, ServiceOpts } from 'koa-clay'
import GameChannelService from '../services/game-channel.service'
import GameFeedbackService from '../services/game-feedback.service'
import PlayerGroupService from '../services/player-group.service'
import OrganisationService from '../services/organisation.service'
import InviteService from '../services/invite.service'
import GameStatService from '../services/game-stat.service'
import GameActivityService from '../services/game-activity.service'
import LeaderboardService from '../services/leaderboard.service'
import DataExportService from '../services/data-export.service'
import APIKeyService from '../services/api-key.service'
import EventService from '../services/event.service'
import HeadlineService from '../services/headline.service'
import PlayerService from '../services/player.service'
import BillingService from '../services/billing.service'
import IntegrationService from '../services/integration.service'
import { getRouteInfo, protectedRouteAuthMiddleware } from '../middleware/route-middleware'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { userRouter } from '../routes/protected/user'
import { gameRouter } from '../routes/protected/game'
import getUserFromToken from '../lib/auth/getUserFromToken'

export default function protectedRoutes(app: Koa) {
  app.use(protectedRouteAuthMiddleware)

  app.use(async function protectedRouteMiddleware(ctx, next) {
    const route = getRouteInfo(ctx)

    if (route.isProtectedRoute) {
      if (route.isAPICall) {
        ctx.throw(401)
      }

      try {
        ctx.state.authenticatedUser = await getUserFromToken(ctx)
      } catch {
        return await next()
      }

      setTraceAttributes({
        user_id: ctx.state.user.sub
      })
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
  app.use(service('/games/:gameId/game-feedback', new GameFeedbackService(), serviceOpts))
  app.use(service('/games/:gameId/game-channels', new GameChannelService(), serviceOpts))

  // new router-based routes
  app.use(userRouter().routes())
  app.use(gameRouter().routes())
}
