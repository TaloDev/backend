import { protectedRouter } from '../../../lib/routing/router.js'
import { checkoutSessionRoute } from './checkout-session.js'
import { confirmPlanRoute } from './confirm-plan.js'
import { organisationPlanRoute } from './organisation-plan.js'
import { plansRoute } from './plans.js'
import { portalSessionRoute } from './portal-session.js'
import { usageRoute } from './usage.js'

export function billingRouter() {
  return protectedRouter('/billing', ({ route }) => {
    route(plansRoute)
    route(checkoutSessionRoute)
    route(confirmPlanRoute)
    route(portalSessionRoute)
    route(usageRoute)
    route(organisationPlanRoute)
  })
}
