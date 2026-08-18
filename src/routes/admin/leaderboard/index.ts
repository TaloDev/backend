import type Router from 'koa-tree-router'
import { adminRouter } from '../../../lib/routing/router.js'
import { createLeaderboardAdminRoute } from './create.js'
import { listEntriesAdminRoute } from './entries.js'
import { listLeaderboardsAdminRoute } from './list.js'
import { resetLeaderboardAdminRoute } from './reset.js'
import { updateLeaderboardEntryAdminRoute } from './update-entry.js'
import { updateLeaderboardAdminRoute } from './update.js'

export function leaderboardAdminRouter(router: Router) {
  adminRouter(
    '/admin/v1/leaderboards',
    ({ route }) => {
      route(createLeaderboardAdminRoute)
      route(listLeaderboardsAdminRoute)
      route(listEntriesAdminRoute)
      route(updateLeaderboardAdminRoute)
      route(updateLeaderboardEntryAdminRoute)
      route(resetLeaderboardAdminRoute)
    },
    { router, docsKey: 'LeaderboardAdminAPI' },
  )
}
