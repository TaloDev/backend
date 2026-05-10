import Koa from 'koa'
import {
  protectedRouteAuthMiddleware,
  protectedRouteUserMiddleware,
} from '../middleware/protected-route-middleware.js'
import { apiKeyRouter } from '../routes/protected/api-key/index.js'
import { billingRouter } from '../routes/protected/billing/index.js'
import { chartRouter } from '../routes/protected/chart/index.js'
import { dataExportRouter } from '../routes/protected/data-export/index.js'
import { eventRouter } from '../routes/protected/event/index.js'
import { gameActivityRouter } from '../routes/protected/game-activity/index.js'
import { gameChannelRouter } from '../routes/protected/game-channel/index.js'
import { gameFeedbackRouter } from '../routes/protected/game-feedback/index.js'
import { gameStatRouter } from '../routes/protected/game-stat/index.js'
import { gameRouter } from '../routes/protected/game/index.js'
import { headlineRouter } from '../routes/protected/headline/index.js'
import { integrationRouter } from '../routes/protected/integration/index.js'
import { inviteRouter } from '../routes/protected/invite/index.js'
import { leaderboardRouter } from '../routes/protected/leaderboard/index.js'
import { organisationRouter } from '../routes/protected/organisation/index.js'
import { playerGroupRouter } from '../routes/protected/player-group/index.js'
import { playerRouter } from '../routes/protected/player/index.js'
import { userRouter } from '../routes/protected/user/index.js'

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
