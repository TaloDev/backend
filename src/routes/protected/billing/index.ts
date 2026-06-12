import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { checkoutSessionRoute } from './checkout-session.js'
import { confirmPlanRoute } from './confirm-plan.js'
import { organisationPlanRoute } from './organisation-plan.js'
import { plansRoute } from './plans.js'
import { portalSessionRoute } from './portal-session.js'
import { usageRoute } from './usage.js'

export function billingRouter(router: Router) {
  protectedRouter(
    '/billing',
    ({ route }) => {
      route(plansRoute)
      route(checkoutSessionRoute)
      route(confirmPlanRoute)
      route(portalSessionRoute)
      route(usageRoute)
      route(organisationPlanRoute)
    },
    { router },
  )
}
