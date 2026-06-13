import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { createRoute } from './create.js'
import { deleteRoute } from './delete.js'
import { listRoute } from './list.js'

export function gameVerificationKeyRouter(router: Router) {
  protectedRouter(
    '/games/:gameId/verification-keys',
    ({ route }) => {
      route(listRoute)
      route(createRoute)
      route(deleteRoute)
    },
    { router },
  )
}
