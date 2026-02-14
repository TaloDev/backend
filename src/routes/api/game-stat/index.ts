import { apiRouter } from '../../../lib/routing/router'
import { listRoute } from './list'
import { getRoute } from './get'
import { listPlayerStatsRoute } from './list-player-stats'
import { getPlayerStatRoute } from './get-player-stat'
import { putRoute } from './put'
import { historyRoute } from './history'
import { globalHistoryRoute } from './global-history'
import { RouterGroup } from '../../../lib/routing/router-group'

export function gameStatAPIRouter() {
  const opts = {
    docsKey: 'GameStatAPI'
  }

  return new RouterGroup([
    // static routes - mounted first so /player-stats
    // is checked before /:internalName
    apiRouter('/v1/game-stats', ({ route }) => {
      route(listRoute)
      route(listPlayerStatsRoute)
    }, opts),
    // parameterized routes
    apiRouter('/v1/game-stats', ({ route }) => {
      route(historyRoute)
      route(globalHistoryRoute)
      route(getPlayerStatRoute)
      route(getRoute)
      route(putRoute)
    }, opts)
  ])
}
