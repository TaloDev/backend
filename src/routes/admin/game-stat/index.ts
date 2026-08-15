import type Router from 'koa-tree-router'
import { adminRouter } from '../../../lib/routing/router.js'
import { createStatAdminRoute } from './create.js'
import { findStatAdminRoute } from './find.js'
import { listStatsAdminRoute } from './list.js'
import { updateStatAdminRoute } from './update.js'

export function gameStatAdminRouter(router: Router) {
  adminRouter(
    '/admin/v1/game-stats',
    ({ route }) => {
      route(createStatAdminRoute)
      route(listStatsAdminRoute)
      route(findStatAdminRoute)
      route(updateStatAdminRoute)
    },
    { router, docsKey: 'GameStatAdminAPI' },
  )
}
