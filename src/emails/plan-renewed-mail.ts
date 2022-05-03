import Organisation from '../entities/organisation'
import Mail from './mail'

export default class PlanRenewed extends Mail {
  constructor(organisation: Organisation) {
    super(organisation.email, 'Subscription renewed', 'Your subscription has been successfully renewed and will carry on as normal. Thank you for choosing to continue your Talo subscription.')

    this.title = 'Subscription renewed'
    this.mainText = 'Thanks for renewing your subscription! Your renewal was successful and your subscription will carry on as normal.'

    this.why = 'You are receiving this email because your Talo subscription was updated'
  }
}
