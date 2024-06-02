import { format } from 'date-fns'
import Organisation from '../entities/organisation.js'
import Mail from './mail.js'

export default class PlanCancelled extends Mail {
  constructor(organisation: Organisation) {
    const formattedDate = format(new Date(organisation.pricingPlan.endDate), 'do MMM yyyy')

    super(organisation.email, 'Subscription cancelled', `Your subscription has been successfully cancelled and will end on ${formattedDate}. In the mean time, you can renew your plan through the billing portal if you change your mind.`)

    this.title = 'Subscription cancelled'
    this.mainText = `Your subscription has been successfully cancelled and will end on ${formattedDate}. After this date, you will be downgraded to our free plan.<br/><br/>You will need to contact support about removing users if you have more members in your organisation than the user seat limit for the free plan.<br/><br/>In the mean time, you can renew your plan through the billing portal if you change your mind.`

    this.why = 'You are receiving this email because your Talo subscription was updated'
  }
}
