import type Router from 'koa-tree-router'
import { apiRouter } from '../../../lib/routing/router.js'
import { getPlayerStatRoute } from './get-player-stat.js'
import { getRoute } from './get.js'
import { globalHistoryRoute } from './global-history.js'
import { historyRoute } from './history.js'
import { listPlayerStatsRoute } from './list-player-stats.js'
import { listRoute } from './list.js'
import { putRoute } from './put.js'

export function gameStatAPIRouter(router: Router, paramRouter: Router) {
  const docsKey = 'GameStatAPI'

  // static routes - mounted first so /player-stats
  // is checked before /:internalName
  apiRouter(
    '/v1/game-stats',
    ({ route }) => {
      route(listRoute)
      route(listPlayerStatsRoute)
    },
    { router, docsKey },
  )

  // parameterized routes
  apiRouter(
    '/v1/game-stats',
    ({ route }) => {
      route(historyRoute)
      route(globalHistoryRoute)
      route(getPlayerStatRoute)
      route(getRoute)
      route(putRoute)
    },
    { router: paramRouter, docsKey },
  )
}
