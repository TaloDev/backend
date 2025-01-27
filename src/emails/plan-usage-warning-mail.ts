import Organisation from '../entities/organisation'
import Mail from './mail'

export default class PlanUsageWarning extends Mail {
  constructor(organisation: Organisation, usage: number, limit: number) {
    const usagePercentage = Math.floor((usage / limit) * 100)

    let subject = `Usage warning: ${usagePercentage}% of your plan limit reached`
    let preheader = 'Your player count is approaching your pricing plan limit.'

    let title = 'Player limit warning'
    let mainText = `You have used ${usagePercentage}% of your current pricing plan limit (${usage.toLocaleString()}/${limit.toLocaleString()} players). Please consider upgrading your plan to avoid disruption.`

    if (usagePercentage >= 100) {
      subject = `Urgent: ${usagePercentage}% of your plan limit reached`
      preheader = 'Your player count has reached your pricing plan limit.'

      title = 'Player limit reached'
      mainText = `
        You have reached your pricing plan limit of ${limit.toLocaleString()} players. 
        <br/><br/>
        You will encounter errors when your player count reaches 105% of your limit. 
        We recommend upgrading your plan immediately to avoid disruption.
      `
    }

    super(organisation.email, subject, preheader)

    this.title = title
    this.mainText = mainText

    this.ctaText = 'Go to billing'
    this.ctaLink = `${process.env.DASHBOARD_URL}/billing`

    this.why = 'You are receiving this email because your player count is approaching or exceeding your pricing plan limit'
  }
}
