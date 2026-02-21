import { protectedRouter } from '../../../lib/routing/router'
import { createRoute } from './create'
import { deleteRoute } from './delete'
import { listRoute } from './list'
import { syncLeaderboardsRoute } from './sync-leaderboards'
import { syncStatsRoute } from './sync-stats'
import { updateRoute } from './update'

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
