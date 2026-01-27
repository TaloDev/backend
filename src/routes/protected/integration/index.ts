import { protectedRouter } from '../../../lib/routing/router'
import { listRoute } from './list'
import { createRoute } from './create'
import { updateRoute } from './update'
import { deleteRoute } from './delete'
import { syncLeaderboardsRoute } from './sync-leaderboards'
import { syncStatsRoute } from './sync-stats'

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
