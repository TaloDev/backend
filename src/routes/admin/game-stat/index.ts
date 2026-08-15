import type Router from 'koa-tree-router'
import { adminRouter } from '../../../lib/routing/router.js'
import { createStatAdminRoute } from './create.js'
import { listStatsAdminRoute } from './list.js'

export function gameStatAdminRouter(router: Router) {
  adminRouter(
    '/admin/v1/game-stats',
    ({ route }) => {
      route(createStatAdminRoute)
      route(listStatsAdminRoute)
    },
    { router, docsKey: 'adminGameStats' },
  )
}
