import type Router from 'koa-tree-router'
import { adminRouter } from '../../../lib/routing/router.js'
import { deletePlayerAdminRoute } from './delete.js'
import { getPlayerAdminRoute } from './get.js'
import { listPlayersAdminRoute } from './list.js'
import { updatePlayerAdminRoute } from './update.js'

export function playerAdminRouter(router: Router) {
  adminRouter(
    '/admin/v1/players',
    ({ route }) => {
      route(listPlayersAdminRoute)
      route(getPlayerAdminRoute)
      route(updatePlayerAdminRoute)
      route(deletePlayerAdminRoute)
    },
    { router, docsKey: 'PlayerAdminAPI' },
  )
}
