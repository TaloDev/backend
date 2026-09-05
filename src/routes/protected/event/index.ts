import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { breakdownRoute } from './breakdown.js'
import { catalogueRoute } from './catalogue.js'
import { listRoute } from './list.js'
import { purgeRoute } from './purge.js'

export function eventRouter(router: Router) {
  protectedRouter(
    '/games/:gameId/events',
    ({ route }) => {
      route(listRoute)
      route(breakdownRoute)
      route(catalogueRoute)
      route(purgeRoute)
    },
    { router },
  )
}
