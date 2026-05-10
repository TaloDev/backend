import { protectedRouter } from '../../../lib/routing/router.js'
import { createRoute } from './create.js'
import { deleteRoute } from './delete.js'
import { listRoute } from './list.js'
import { syncLeaderboardsRoute } from './sync-leaderboards.js'
import { syncStatsRoute } from './sync-stats.js'
import { updateRoute } from './update.js'

export function integrationRouter() {
  return protectedRouter('/games/:gameId/integrations', ({ route }) => {
    route(listRoute)
    route(createRoute)
    route(updateRoute)
    route(deleteRoute)
    route(syncLeaderboardsRoute)
    route(syncStatsRoute)
  })
}
