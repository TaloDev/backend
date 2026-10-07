import Organisation from '../entities/organisation.js'
import Mail from './mail.js'

type PlanDowngradeReminderData = {
  organisation: Organisation
  playerCount: number
  suggestedLimit: number
  // null when the suggestion is the free plan
  paidPlanName: string | null
}

export default class PlanDowngradeReminder extends Mail {
  constructor({
    organisation,
    playerCount,
    suggestedLimit,
    paidPlanName,
  }: PlanDowngradeReminderData) {
    const plan = paidPlanName === null ? 'our free plan' : `the ${paidPlanName}`

    super(
      organisation.email,
      'Plan downgrade reminder',
      'Your player count is still below your pricing plan limit.',
    )

    this.title = 'Plan downgrade reminder'
    this.mainText = `Your organisation still has ${playerCount.toLocaleString()} players. You can move down to ${plan} (${suggestedLimit.toLocaleString()} players). Your plan will not change until you choose a new one.`

    this.ctaLink = `${process.env.DASHBOARD_URL}/billing`
    this.ctaText = 'Go to billing'

    this.why =
      'You are receiving this email because your player count is below your pricing plan limit'
  }
}
