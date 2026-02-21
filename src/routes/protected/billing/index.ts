import { protectedRouter } from '../../../lib/routing/router'
import { checkoutSessionRoute } from './checkout-session'
import { confirmPlanRoute } from './confirm-plan'
import { organisationPlanRoute } from './organisation-plan'
import { plansRoute } from './plans'
import { portalSessionRoute } from './portal-session'
import { usageRoute } from './usage'

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
