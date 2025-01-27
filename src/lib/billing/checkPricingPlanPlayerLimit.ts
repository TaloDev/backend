import { EntityManager } from '@mikro-orm/mysql'
import { Request } from 'koa-clay'
import Organisation from '../../entities/organisation'
import Player from '../../entities/player'
import PlanUsageWarning from '../../emails/plan-usage-warning-mail'
import queueEmail from '../messaging/queueEmail'

const OVERAGE_PERCENTAGE = 1.05

export default async function checkPricingPlanPlayerLimit(
  req: Request,
  organisation: Organisation
): Promise<void> {
  const em: EntityManager = req.ctx.em
  const organisationPricingPlan = organisation.pricingPlan

  if (organisationPricingPlan.status !== 'active') {
    req.ctx.throw(402, 'Your subscription is in an incomplete state. Please update your billing details.')
  }

  const planPlayerLimit = organisationPricingPlan.pricingPlan.playerLimit ?? Infinity
  const playerCount = await em.getRepository(Player).count({
    game: { organisation }
  }) + 1

  if (playerCount > (planPlayerLimit * OVERAGE_PERCENTAGE)) {
    req.ctx.throw(402, { limit: planPlayerLimit })
  } else {
    const usagePercentage = playerCount / planPlayerLimit * 100
    if (usagePercentage == 75 || usagePercentage == 90 || usagePercentage == 100) {
      await queueEmail(req.ctx.emailQueue, new PlanUsageWarning(organisation, playerCount, planPlayerLimit))
    }
  }
}
