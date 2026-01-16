import { protectedRouter } from '../../../lib/routing/router'
import { plansRoute } from './plans'
import { checkoutSessionRoute } from './checkout-session'
import { confirmPlanRoute } from './confirm-plan'
import { portalSessionRoute } from './portal-session'
import { usageRoute } from './usage'
import { organisationPlanRoute } from './organisation-plan'

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
