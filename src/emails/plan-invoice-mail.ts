import { format } from 'date-fns'
import Stripe from 'stripe'
import Organisation from '../entities/organisation'
import Mail from './mail'
import { USD } from '@dinero.js/currencies'
import { dinero, toFormat } from 'dinero.js'

export default class PlanInvoice extends Mail {
  constructor(organisation: Organisation, invoice: Stripe.Invoice) {
    super(organisation.email, 'Your invoice is ready', '')

    this.title = 'Thanks for using Talo!'
    this.mainText = `Your ${format(new Date(), 'MMMM yyyy')} invoice is ready.<br/><br/>The balance due is: <strong>${this.getPrice(invoice.amount_due)}</strong>.<br/><br/>The balance will be automatically charged to your card so you don't need to do anything.`
    this.template = this.template.replace('{{mainText}}', this.mainText)

    this.ctaLink = invoice.hosted_invoice_url
    this.ctaText = 'View invoice'

    this.why = 'You are receiving this email because your Talo subscription was updated'
  }

  private getPrice(amount: number): string {
    const d = dinero({ amount, currency: USD })
    const transformer = ({ amount }) => `$${amount.toFixed(2)}`
    return toFormat(d, transformer)
  }
}