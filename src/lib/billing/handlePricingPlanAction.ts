import { EntityManager } from '@mikro-orm/mysql'
import { isSameMonth } from 'date-fns'
import { Request } from 'koa-clay'
import Organisation from '../../entities/organisation.js'
import OrganisationPricingPlanAction, { OrganisationPricingPlanActionExtra } from '../../entities/organisation-pricing-plan-action.js'
import PricingPlanAction, { PricingPlanActionType } from '../../entities/pricing-plan-action.js'

export default async function handlePricingPlanAction(
  req: Request,
  actionType: PricingPlanActionType,
  newActionExtra: OrganisationPricingPlanActionExtra = {}
): Promise<OrganisationPricingPlanAction | null> {
  const em: EntityManager = req.ctx.em
  const organisation: Organisation = req.ctx.state.user.organisation

  if (organisation.pricingPlan.status !== 'active') {
    req.ctx.throw(402, 'Your subscription is in an incomplete state. Please update your billing details.')
  }

  const pricingPlanAction = await em.getRepository(PricingPlanAction).findOne({
    type: actionType,
    pricingPlan: organisation.pricingPlan.pricingPlan
  })

  if (!pricingPlanAction) return null

  const organisationPricingPlanActions = await em.getRepository(OrganisationPricingPlanAction).find({
    organisationPricingPlan: organisation.pricingPlan,
    type: actionType
  })

  const filteredActions = organisationPricingPlanActions.filter((orgPlanAction) => {
    return pricingPlanAction.isTrackedMonthly()
      ? isSameMonth(orgPlanAction.createdAt, new Date())
      : true
  })

  if (filteredActions.length >= pricingPlanAction.limit) {
    req.ctx.throw(402, { limit: pricingPlanAction.limit })
  } else {
    const orgPlanAction = new OrganisationPricingPlanAction()
    orgPlanAction.organisationPricingPlan = organisation.pricingPlan
    orgPlanAction.type = pricingPlanAction.type
    orgPlanAction.extra = newActionExtra

    await em.persistAndFlush(orgPlanAction)

    return orgPlanAction
  }
}
