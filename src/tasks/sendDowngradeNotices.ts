import type Stripe from 'stripe'
import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import { subDays } from 'date-fns'
import { getGlobalQueue } from '../config/global-queues.js'
import { getMikroORM } from '../config/mikro-orm.config.js'
import PlanDowngradeAvailable from '../emails/plan-downgrade-available-mail.js'
import PlanDowngradeReminder from '../emails/plan-downgrade-reminder-mail.js'
import OrganisationPricingPlan from '../entities/organisation-pricing-plan.js'
import PricingPlan from '../entities/pricing-plan.js'
import { getUsageBucket } from '../lib/billing/checkPricingPlanPlayerLimit.js'
import { getBillablePlayerCount } from '../lib/billing/getBillablePlayerCount.js'
import initStripe from '../lib/billing/initStripe.js'
import queueEmail from '../lib/messaging/queueEmail.js'

type PlanWithLimit = PricingPlan & { playerLimit: number }

const REMINDER_DELAY_DAYS = 7
const REMINDER_INTERVAL_DAYS = 30

// the largest plan the player count sits comfortably under,
// i.e. below the plan's first usage warning threshold
function findDowngradeTarget(
  plans: PricingPlan[],
  currentPlayerLimit: number,
  playerCount: number,
): PlanWithLimit | null {
  const candidates = plans.filter((plan): plan is PlanWithLimit => {
    if (plan.playerLimit === null || plan.playerLimit >= currentPlayerLimit) {
      return false
    }

    return getUsageBucket((playerCount / plan.playerLimit) * 100) === null
  })

  return candidates.sort((a, b) => b.playerLimit - a.playerLimit)[0] ?? null
}

async function resetDowngradeNotice(em: EntityManager, orgPlan: OrganisationPricingPlan) {
  if (!orgPlan.downgradeNoticeSentAt && !orgPlan.downgradeReminderSentAt) {
    return
  }

  orgPlan.downgradeNoticeSentAt = null
  orgPlan.downgradeReminderSentAt = null
  await em.flush()
}

async function getPaidPlanName(stripe: Stripe, target: PlanWithLimit) {
  if (target.default) {
    return null
  }

  const product = await stripe.products.retrieve(target.stripeId)
  return product.name
}

async function notifyOrganisation({
  em,
  stripe,
  orgPlan,
  plans,
  now,
}: {
  em: EntityManager
  stripe: Stripe
  orgPlan: OrganisationPricingPlan
  plans: PricingPlan[]
  now: Date
}) {
  const { pricingPlan } = orgPlan
  const currentPlayerLimit = pricingPlan.playerLimit

  // free, custom and unlimited plans have nothing to downgrade to
  if (currentPlayerLimit === null || pricingPlan.hidden || pricingPlan.default) {
    await resetDowngradeNotice(em, orgPlan)
    return
  }

  const playerCount = await getBillablePlayerCount(em, orgPlan.organisation)
  const target = findDowngradeTarget(plans, currentPlayerLimit, playerCount)

  // no longer over-provisioned - reset so a future drop notifies again
  if (!target) {
    await resetDowngradeNotice(em, orgPlan)
    return
  }

  const emailQueue = getGlobalQueue('email')

  if (!orgPlan.downgradeNoticeSentAt) {
    const paidPlanName = await getPaidPlanName(stripe, target)

    await queueEmail(
      emailQueue,
      new PlanDowngradeAvailable({
        organisation: orgPlan.organisation,
        playerCount,
        suggestedLimit: target.playerLimit,
        paidPlanName,
      }),
    )
    orgPlan.downgradeNoticeSentAt = now
    await em.flush()
    return
  }

  // remind a week after the notice, then monthly until the plan fits
  if (orgPlan.downgradeNoticeSentAt > subDays(now, REMINDER_DELAY_DAYS)) {
    return
  }

  const lastRemindedAt = orgPlan.downgradeReminderSentAt
  if (lastRemindedAt && lastRemindedAt > subDays(now, REMINDER_INTERVAL_DAYS)) {
    return
  }

  const paidPlanName = await getPaidPlanName(stripe, target)

  await queueEmail(
    emailQueue,
    new PlanDowngradeReminder({
      organisation: orgPlan.organisation,
      playerCount,
      suggestedLimit: target.playerLimit,
      paidPlanName,
    }),
  )
  orgPlan.downgradeReminderSentAt = now
  await em.flush()
}

export async function sendDowngradeNotices() {
  const stripe = initStripe()
  /* v8 ignore next 3 -- @preserve */
  if (!stripe) {
    return
  }

  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager
  const now = new Date()

  const plans = await em.repo(PricingPlan).find({ hidden: false })
  const orgPlanIds = (
    await em.repo(OrganisationPricingPlan).find(
      {
        stripeCustomerId: { $ne: null },
        status: 'active',
        organisation: { deletedAt: null },
      },
      { fields: ['id'] },
    )
  ).map((orgPlan) => orgPlan.id)

  for (const id of orgPlanIds) {
    const fork = em.fork()
    try {
      const orgPlan = await fork.repo(OrganisationPricingPlan).findOneOrFail(
        { id },
        {
          populate: ['organisation'],
        },
      )

      await notifyOrganisation({ em: fork, stripe, orgPlan, plans, now })
    } catch (err) {
      console.error(`Error sending downgrade notice for organisation pricing plan ${id}:`, err)
      captureException(err)
    }
  }
}
