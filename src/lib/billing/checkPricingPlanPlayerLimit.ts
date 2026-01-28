import { EntityManager } from '@mikro-orm/mysql'
import Organisation from '../../entities/organisation'
import PlanUsageWarning from '../../emails/plan-usage-warning-mail'
import queueEmail from '../messaging/queueEmail'
import getBillablePlayerCount from './getBillablePlayerCount'
import { getGlobalQueue } from '../../config/global-queues'

const OVERAGE_PERCENTAGE = 1.05

export class PricingPlanLimitError<T> extends Error {
  data?: T

  constructor(message: string, data?: T) {
    super(message)
    this.name = 'PricingPlanLimitError'
    this.data = data
  }
}


export default async function checkPricingPlanPlayerLimit(
  em: EntityManager,
  organisation: Organisation
) {
  const organisationPricingPlan = organisation.pricingPlan

  if (organisationPricingPlan.status !== 'active') {
    throw new PricingPlanLimitError('Your subscription is in an incomplete state. Please update your billing details.')
  }

  const planPlayerLimit = organisationPricingPlan.pricingPlan.playerLimit ?? Infinity
  const playerCount = await getBillablePlayerCount(em, organisation) + 1

  if (playerCount > (planPlayerLimit * OVERAGE_PERCENTAGE)) {
    throw new PricingPlanLimitError('Limit reached', { limit: planPlayerLimit })
  } else {
    const usagePercentage = playerCount / planPlayerLimit * 100
    if (usagePercentage == 75 || usagePercentage == 90 || usagePercentage == 100) {
      await queueEmail(getGlobalQueue('email'), new PlanUsageWarning(organisation, playerCount, planPlayerLimit))
    }
  }
}
