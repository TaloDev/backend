import type Router from 'koa-tree-router'
import { adminRouter } from '../../../lib/routing/router.js'
import { aggregateEventsAdminRoute } from './aggregate.js'
import { listEventsAdminRoute } from './list.js'

export function eventAdminRouter(router: Router) {
  adminRouter(
    '/admin/v1/events',
    ({ route }) => {
      route(listEventsAdminRoute)
      route(aggregateEventsAdminRoute)
    },
    { router, docsKey: 'EventAdminAPI' },
  )
}
