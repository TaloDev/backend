import { apiRouter } from '../../../lib/routing/router'
import { RouterGroup } from '../../../lib/routing/router-group'
import { getRoute } from './get'
import { getPlayerStatRoute } from './get-player-stat'
import { globalHistoryRoute } from './global-history'
import { historyRoute } from './history'
import { listRoute } from './list'
import { listPlayerStatsRoute } from './list-player-stats'
import { putRoute } from './put'

export function gameStatAPIRouter() {
  const opts = {
    docsKey: 'GameStatAPI',
  }

  return new RouterGroup([
    // static routes - mounted first so /player-stats
    // is checked before /:internalName
    apiRouter(
      '/v1/game-stats',
      ({ route }) => {
        route(listRoute)
        route(listPlayerStatsRoute)
      },
      opts,
    ),
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
      opts,
    ),
  ])
}
