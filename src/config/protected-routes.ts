import Koa from 'koa'
import { gameChannelRouter } from '../routes/protected/game-channel'
import { gameFeedbackRouter } from '../routes/protected/game-feedback'
import { gameStatRouter } from '../routes/protected/game-stat'
import { playerGroupRouter } from '../routes/protected/player-group'
import { gameActivityRouter } from '../routes/protected/game-activity'
import { leaderboardRouter } from '../routes/protected/leaderboard'
import { dataExportRouter } from '../routes/protected/data-export'
import { apiKeyRouter } from '../routes/protected/api-key'
import { eventRouter } from '../routes/protected/event'
import { headlineRouter } from '../routes/protected/headline'
import { playerRouter } from '../routes/protected/player'
import { billingRouter } from '../routes/protected/billing'
import { integrationRouter } from '../routes/protected/integration'
import { userRouter } from '../routes/protected/user'
import { gameRouter } from '../routes/protected/game'
import { inviteRouter } from '../routes/protected/invite'
import { organisationRouter } from '../routes/protected/organisation'
import { protectedRouteAuthMiddleware, protectedRouteUserMiddleware } from '../middleware/protected-route-middleware'

export function configureProtectedRoutes(app: Koa) {
  app.use(protectedRouteAuthMiddleware)
  app.use(protectedRouteUserMiddleware)

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
  app.use(leaderboardRouter().routes())
  app.use(organisationRouter().routes())
  app.use(playerGroupRouter().routes())
  app.use(playerRouter().routes())
  app.use(userRouter().routes())
}
