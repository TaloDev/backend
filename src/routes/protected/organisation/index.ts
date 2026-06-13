import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { currentRoute } from './current.js'
import { removeMemberRoute } from './remove-member.js'

export function organisationRouter(router: Router) {
  protectedRouter(
    '/organisations',
    ({ route }) => {
      route(currentRoute)
      route(removeMemberRoute)
    },
    { router },
  )
}
