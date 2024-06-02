import Stripe from 'stripe'
import Organisation from '../entities/organisation.js'
import Mail from './mail.js'

export default class PlanUpgraded extends Mail {
  constructor(organisation: Organisation, price: Stripe.Price, product: Stripe.Product) {
    super(organisation.email, 'Your new Talo subscription', `Your plan has been successfully changed. Your organisation has now been moved to the ${product.name}, recurring ${price.recurring.interval}ly. An invoice for this will be sent to you when your new plan starts.`)

    this.title = 'Your plan has changed'
    this.mainText = `Your organisation has now been moved to the ${product.name}, recurring ${price.recurring.interval}ly. An invoice for this will be sent to you when your new plan starts.`

    this.why = 'You are receiving this email because your Talo subscription was updated'
  }
}
