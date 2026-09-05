import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { deleteRoute } from './delete.js'
import { upsertRoute } from './upsert.js'

export function eventRetentionRouter(router: Router) {
  protectedRouter(
    '/games/:gameId/events/retention',
    ({ route }) => {
      route(upsertRoute)
      route(deleteRoute)
    },
    { router },
  )
}
