import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { acceptInviteRoute } from '../invite/accept.js'
import { changeMemberTypeRoute } from './change-member-type.js'
import { currentRoute } from './current.js'
import { listMembershipsRoute } from './list-memberships.js'
import { removeMemberRoute } from './remove-member.js'
import { switchOrganisationRoute } from './switch.js'

export function organisationRouter(router: Router) {
  protectedRouter(
    '/organisations',
    ({ route }) => {
      route(currentRoute)
      route(listMembershipsRoute)
      route(switchOrganisationRoute)
      route(acceptInviteRoute)
      route(removeMemberRoute)
      route(changeMemberTypeRoute)
    },
    { router },
  )
}
