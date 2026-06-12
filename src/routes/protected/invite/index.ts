import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { createRoute } from './create.js'
import { listRoute } from './list.js'

export function inviteRouter(router: Router) {
  protectedRouter(
    '/invites',
    ({ route }) => {
      route(listRoute)
      route(createRoute)
    },
    { router },
  )
}
