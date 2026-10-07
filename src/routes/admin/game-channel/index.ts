import type Router from 'koa-tree-router'
import { adminRouter } from '../../../lib/routing/router.js'
import { createChannelAdminRoute } from './create.js'
import { deleteChannelAdminRoute } from './delete.js'
import { listChannelsAdminRoute } from './list.js'
import { listChannelStorageAdminRoute } from './storage.js'
import { updateChannelAdminRoute } from './update.js'

export function gameChannelAdminRouter(router: Router) {
  adminRouter(
    '/admin/v1/game-channels',
    ({ route }) => {
      route(listChannelsAdminRoute)
      route(createChannelAdminRoute)
      route(updateChannelAdminRoute)
      route(deleteChannelAdminRoute)
      route(listChannelStorageAdminRoute)
    },
    { router, docsKey: 'GameChannelAdminAPI' },
  )
}
