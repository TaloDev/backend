import type Router from 'koa-tree-router'
import { adminRouter } from '../../../lib/routing/router.js'
import { getGameConfigAdminRoute } from './get.js'
import { createScheduledChangeAdminRoute } from './scheduled-changes/create.js'
import { deleteScheduledChangeAdminRoute } from './scheduled-changes/delete.js'
import { listScheduledChangesAdminRoute } from './scheduled-changes/list.js'
import { updateGameConfigAdminRoute } from './update.js'

export function gameConfigAdminRouter(router: Router) {
  adminRouter(
    '/admin/v1/game-config',
    ({ route }) => {
      route(getGameConfigAdminRoute)
      route(updateGameConfigAdminRoute)
      route(listScheduledChangesAdminRoute)
      route(createScheduledChangeAdminRoute)
      route(deleteScheduledChangeAdminRoute)
    },
    { router, docsKey: 'GameConfigAdminAPI' },
  )
}
