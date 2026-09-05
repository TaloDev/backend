import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { createRoute } from './create.js'
import { deleteRoute } from './delete.js'
import { getRoute } from './get.js'
import { listRoute } from './list.js'
import { previewRoute } from './preview.js'
import { refreshRoute } from './refresh.js'
import { updateRoute } from './update.js'

export function eventFunnelRouter(router: Router) {
  protectedRouter(
    '/games/:gameId/event-funnels',
    ({ route }) => {
      route(previewRoute)
      route(createRoute)
      route(listRoute)
      route(getRoute)
      route(updateRoute)
      route(deleteRoute)
      route(refreshRoute)
    },
    { router },
  )
}
