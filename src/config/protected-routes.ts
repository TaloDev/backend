import Koa from 'koa'
import {
  protectedRouteAuthMiddleware,
  protectedRouteUserMiddleware,
} from '../middleware/protected-route-middleware'
import { apiKeyRouter } from '../routes/protected/api-key'
import { billingRouter } from '../routes/protected/billing'
import { chartRouter } from '../routes/protected/chart'
import { dataExportRouter } from '../routes/protected/data-export'
import { eventRouter } from '../routes/protected/event'
import { gameRouter } from '../routes/protected/game'
import { gameActivityRouter } from '../routes/protected/game-activity'
import { gameChannelRouter } from '../routes/protected/game-channel'
import { gameFeedbackRouter } from '../routes/protected/game-feedback'
import { gameStatRouter } from '../routes/protected/game-stat'
import { headlineRouter } from '../routes/protected/headline'
import { integrationRouter } from '../routes/protected/integration'
import { inviteRouter } from '../routes/protected/invite'
import { leaderboardRouter } from '../routes/protected/leaderboard'
import { organisationRouter } from '../routes/protected/organisation'
import { playerRouter } from '../routes/protected/player'
import { playerGroupRouter } from '../routes/protected/player-group'
import { userRouter } from '../routes/protected/user'

export function configureProtectedRoutes(app: Koa) {
  app.use(protectedRouteAuthMiddleware)
  app.use(protectedRouteUserMiddleware)

  app.use(apiKeyRouter().routes())
  app.use(billingRouter().routes())
  app.use(chartRouter().routes())
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
