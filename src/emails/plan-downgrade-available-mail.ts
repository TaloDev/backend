import Organisation from '../entities/organisation.js'
import Mail from './mail.js'

type PlanDowngradeAvailableData = {
  organisation: Organisation
  playerCount: number
  suggestedLimit: number
  // null when the suggestion is the free plan
  paidPlanName: string | null
}

export default class PlanDowngradeAvailable extends Mail {
  constructor({
    organisation,
    playerCount,
    suggestedLimit,
    paidPlanName,
  }: PlanDowngradeAvailableData) {
    const plan = paidPlanName === null ? 'our free plan' : `the ${paidPlanName}`

    super(
      organisation.email,
      'Plan downgrade available',
      'Your player count is below your pricing plan limit.',
    )

    this.title = 'Plan downgrade available'
    this.mainText = `Your organisation has ${playerCount.toLocaleString()} players. You can move down to ${plan} (${suggestedLimit.toLocaleString()} players). Your plan will not change until you choose a new one.`

    this.ctaLink = `${process.env.DASHBOARD_URL}/billing`
    this.ctaText = 'Go to billing'

    this.why =
      'You are receiving this email because your player count is below your pricing plan limit'
  }
}
