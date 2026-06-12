import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { breakdownRoute } from './breakdown.js'
import { listRoute } from './list.js'

export function eventRouter(router: Router) {
  protectedRouter(
    '/games/:gameId/events',
    ({ route }) => {
      route(listRoute)
      route(breakdownRoute)
    },
    { router },
  )
}
