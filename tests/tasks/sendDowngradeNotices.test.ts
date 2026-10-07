import type Stripe from 'stripe'
import { subDays } from 'date-fns'
import assert from 'node:assert'
import PlanDowngradeAvailable from '../../src/emails/plan-downgrade-available-mail.js'
import PlanDowngradeReminder from '../../src/emails/plan-downgrade-reminder-mail.js'
import PricingPlan from '../../src/entities/pricing-plan.js'
import initStripe from '../../src/lib/billing/initStripe.js'
import * as initStripeModule from '../../src/lib/billing/initStripe.js'
import * as sendEmail from '../../src/lib/messaging/sendEmail.js'
import { sendDowngradeNotices } from '../../src/tasks/sendDowngradeNotices.js'
import PlayerFactory from '../fixtures/PlayerFactory.js'
import PricingPlanFactory from '../fixtures/PricingPlanFactory.js'
import createOrganisationAndGame from '../utils/createOrganisationAndGame.js'
import { truncateTables } from '../utils/truncateTables.js'

describe('sendDowngradeNotices', () => {
  const sendMock = vi.spyOn(sendEmail, 'default')

  const stripe = initStripe()
  assert(stripe)

  // the stripe mock returns a single product, so paid plans are named after it
  async function getMockPlanName() {
    assert(stripe)

    const products = await stripe.products.list()
    assert(products.data[0], 'No stripe mock product found')
    return products.data[0].name
  }

  async function addPlan(
    playerLimit: number | null,
    { isDefault = false, hidden = false }: { isDefault?: boolean; hidden?: boolean } = {},
  ) {
    const plan = await new PricingPlanFactory()
      .state(() => ({ playerLimit, default: isDefault, hidden }))
      .one()

    await em.persist(plan).flush()

    return plan
  }

  async function setupOrg({
    currentPlan,
    playerCount = 0,
    withCustomer = true,
    noticeSentAt = null,
    reminderSentAt = null,
  }: {
    currentPlan: PricingPlan
    playerCount?: number
    withCustomer?: boolean
    noticeSentAt?: Date | null
    reminderSentAt?: Date | null
  }) {
    const [organisation, game] = await createOrganisationAndGame({}, {}, currentPlan)

    organisation.pricingPlan.stripeCustomerId = withCustomer ? 'cus_test' : null
    organisation.pricingPlan.downgradeNoticeSentAt = noticeSentAt
    organisation.pricingPlan.downgradeReminderSentAt = reminderSentAt
    await em.flush()

    if (playerCount > 0) {
      const players = await new PlayerFactory([game]).many(playerCount)
      await em.persist(players).flush()
    }

    return organisation
  }

  beforeEach(async () => {
    await truncateTables()
  })

  afterEach(() => {
    sendMock.mockClear()
  })

  it('should send a downgrade notice when the count sits below a smaller plan', async () => {
    await addPlan(2)
    const currentPlan = await addPlan(5)
    const organisation = await setupOrg({ currentPlan })

    await sendDowngradeNotices()

    expect(sendMock).toHaveBeenCalledWith(
      new PlanDowngradeAvailable({
        organisation,
        playerCount: 0,
        suggestedLimit: 2,
        paidPlanName: await getMockPlanName(),
      }).getConfig(),
    )

    await em.refresh(organisation.pricingPlan)
    expect(organisation.pricingPlan.downgradeNoticeSentAt).toBeInstanceOf(Date)
  })

  it('should suggest the largest plan the count fits', async () => {
    await addPlan(2)
    await addPlan(5)
    const currentPlan = await addPlan(10)
    const organisation = await setupOrg({ currentPlan, playerCount: 3 })

    await sendDowngradeNotices()

    // 3 players fits the 5 plan, but not the 2 plan
    expect(sendMock).toHaveBeenCalledWith(
      new PlanDowngradeAvailable({
        organisation,
        playerCount: 3,
        suggestedLimit: 5,
        paidPlanName: await getMockPlanName(),
      }).getConfig(),
    )
  })

  it('should not suggest a plan the count is at the warning threshold for', async () => {
    await addPlan(4)
    const currentPlan = await addPlan(10)
    await setupOrg({ currentPlan, playerCount: 3 })

    await sendDowngradeNotices()

    // 3 players is exactly 75% of the 4 plan limit
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should not send a notice when the count is too close to the smaller plan limit', async () => {
    await addPlan(2)
    const currentPlan = await addPlan(5)
    await setupOrg({ currentPlan, playerCount: 2 })

    await sendDowngradeNotices()

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should not send a notice when there is no smaller plan', async () => {
    const currentPlan = await addPlan(5)
    await setupOrg({ currentPlan })

    await sendDowngradeNotices()

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should send a reminder a week after the notice', async () => {
    await addPlan(2)
    const currentPlan = await addPlan(5)
    const organisation = await setupOrg({
      currentPlan,
      noticeSentAt: subDays(new Date(), 8),
    })

    await sendDowngradeNotices()

    expect(sendMock).toHaveBeenCalledWith(
      new PlanDowngradeReminder({
        organisation,
        playerCount: 0,
        suggestedLimit: 2,
        paidPlanName: await getMockPlanName(),
      }).getConfig(),
    )

    await em.refresh(organisation.pricingPlan)
    expect(organisation.pricingPlan.downgradeReminderSentAt).toBeInstanceOf(Date)
  })

  it('should send a reminder about the free plan', async () => {
    await addPlan(2, { isDefault: true })
    const currentPlan = await addPlan(5)
    const organisation = await setupOrg({
      currentPlan,
      noticeSentAt: subDays(new Date(), 8),
    })

    await sendDowngradeNotices()

    expect(sendMock).toHaveBeenCalledWith(
      new PlanDowngradeReminder({
        organisation,
        playerCount: 0,
        suggestedLimit: 2,
        paidPlanName: null,
      }).getConfig(),
    )
  })

  it('should not send a reminder before a week has passed', async () => {
    await addPlan(2)
    const currentPlan = await addPlan(5)
    await setupOrg({ currentPlan, noticeSentAt: subDays(new Date(), 6) })

    await sendDowngradeNotices()

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should not send another reminder within a month', async () => {
    await addPlan(2)
    const currentPlan = await addPlan(5)
    await setupOrg({
      currentPlan,
      noticeSentAt: subDays(new Date(), 40),
      reminderSentAt: subDays(new Date(), 29),
    })

    await sendDowngradeNotices()

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should send another reminder a month after the last one', async () => {
    await addPlan(2)
    const currentPlan = await addPlan(5)
    const organisation = await setupOrg({
      currentPlan,
      noticeSentAt: subDays(new Date(), 40),
      reminderSentAt: subDays(new Date(), 31),
    })

    await sendDowngradeNotices()

    expect(sendMock).toHaveBeenCalledWith(
      new PlanDowngradeReminder({
        organisation,
        playerCount: 0,
        suggestedLimit: 2,
        paidPlanName: await getMockPlanName(),
      }).getConfig(),
    )

    await em.refresh(organisation.pricingPlan)
    expect(organisation.pricingPlan.downgradeReminderSentAt).toBeInstanceOf(Date)
  })

  it('should reset the notice state when the organisation is no longer over-provisioned', async () => {
    await addPlan(2)
    const currentPlan = await addPlan(5)
    const organisation = await setupOrg({
      currentPlan,
      playerCount: 4,
      noticeSentAt: subDays(new Date(), 8),
      reminderSentAt: subDays(new Date(), 1),
    })

    await sendDowngradeNotices()

    expect(sendMock).not.toHaveBeenCalled()

    await em.refresh(organisation.pricingPlan)
    expect(organisation.pricingPlan.downgradeNoticeSentAt).toBeNull()
    expect(organisation.pricingPlan.downgradeReminderSentAt).toBeNull()
  })

  it('should suggest the free plan when it is the largest plan that fits', async () => {
    await addPlan(2, { isDefault: true })
    const currentPlan = await addPlan(5)
    const organisation = await setupOrg({ currentPlan })

    await sendDowngradeNotices()

    expect(sendMock).toHaveBeenCalledWith(
      new PlanDowngradeAvailable({
        organisation,
        playerCount: 0,
        suggestedLimit: 2,
        paidPlanName: null,
      }).getConfig(),
    )
  })

  it('should not send a notice to organisations on the free plan', async () => {
    const freePlan = await addPlan(2, { isDefault: true })
    await addPlan(1)
    await setupOrg({ currentPlan: freePlan })

    await sendDowngradeNotices()

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should not send a notice to organisations on a custom plan', async () => {
    await addPlan(2)
    const customPlan = await addPlan(5, { hidden: true })
    await setupOrg({ currentPlan: customPlan })

    await sendDowngradeNotices()

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should ignore organisations without a stripe customer', async () => {
    await addPlan(2)
    const currentPlan = await addPlan(5)
    await setupOrg({ currentPlan, withCustomer: false })

    await sendDowngradeNotices()

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should ignore unlimited plans', async () => {
    await addPlan(2)
    const currentPlan = await addPlan(null)
    await setupOrg({ currentPlan })

    await sendDowngradeNotices()

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should not suggest an unlimited plan', async () => {
    await addPlan(2)
    await addPlan(null)
    const currentPlan = await addPlan(5)
    const organisation = await setupOrg({ currentPlan })

    await sendDowngradeNotices()

    expect(sendMock).toHaveBeenCalledWith(
      new PlanDowngradeAvailable({
        organisation,
        playerCount: 0,
        suggestedLimit: 2,
        paidPlanName: await getMockPlanName(),
      }).getConfig(),
    )
  })

  it('should keep notifying other organisations when one fails', async () => {
    const smallPlan = await addPlan(2)
    const midPlan = await addPlan(5)
    const bigPlan = await addPlan(10)

    // targets the small plan, whose product lookup fails
    await setupOrg({ currentPlan: midPlan })
    const healthyOrganisation = await setupOrg({ currentPlan: bigPlan })

    vi.spyOn(initStripeModule, 'default').mockReturnValueOnce({
      products: {
        retrieve: vi.fn(async (stripeId: string) => {
          if (stripeId === smallPlan.stripeId) {
            throw new Error('Stripe is down')
          }

          return { name: 'Team Plan' }
        }),
      },
    } as unknown as Stripe)

    await sendDowngradeNotices()

    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith(
      new PlanDowngradeAvailable({
        organisation: healthyOrganisation,
        playerCount: 0,
        suggestedLimit: 5,
        paidPlanName: 'Team Plan',
      }).getConfig(),
    )
  })
})
