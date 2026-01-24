import Koa from 'koa'
import { service, ServiceOpts } from 'koa-clay'
import { gameChannelRouter } from '../routes/protected/game-channel'
import { gameFeedbackRouter } from '../routes/protected/game-feedback'
import { gameStatRouter } from '../routes/protected/game-stat'
import { playerGroupRouter } from '../routes/protected/player-group'
import { gameActivityRouter } from '../routes/protected/game-activity'
import LeaderboardService from '../services/leaderboard.service'
import { dataExportRouter } from '../routes/protected/data-export'
import { apiKeyRouter } from '../routes/protected/api-key'
import { eventRouter } from '../routes/protected/event'
import { headlineRouter } from '../routes/protected/headline'
import PlayerService from '../services/player.service'
import { billingRouter } from '../routes/protected/billing'
import { integrationRouter } from '../routes/protected/integration'
import { getRouteInfo, protectedRouteAuthMiddleware } from '../middleware/route-middleware'
import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { userRouter } from '../routes/protected/user'
import { gameRouter } from '../routes/protected/game'
import { inviteRouter } from '../routes/protected/invite'
import { organisationRouter } from '../routes/protected/organisation'
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
  app.use(service('/games/:gameId/leaderboards', new LeaderboardService(), serviceOpts))
  app.use(service('/games/:gameId/players', new PlayerService(), serviceOpts))

  // new router-based routes
  app.use(apiKeyRouter().routes())
  app.use(billingRouter().routes())
  app.use(dataExportRouter().routes())
  app.use(eventRouter().routes())
  app.use(gameActivityRouter().routes())
  app.use(gameChannelRouter().routes())
  app.use(gameFeedbackRouter().routes())
  app.use(gameRouter().routes())
  app.use(gameStatRouter().routes())
  app.use(headlineRouter().routes())
  app.use(integrationRouter().routes())
  app.use(inviteRouter().routes())
  app.use(organisationRouter().routes())
  app.use(playerGroupRouter().routes())
  app.use(userRouter().routes())
}
