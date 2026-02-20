import { USD } from '@dinero.js/currencies'
import { format } from 'date-fns'
import { dinero, toDecimal } from 'dinero.js'
import Stripe from 'stripe'
import Organisation from '../entities/organisation'
import Mail from './mail'

export default class PlanInvoice extends Mail {
  constructor(organisation: Organisation, invoice: Stripe.Invoice) {
    super(organisation.email, 'Your invoice is ready', '')

    this.title = 'Thanks for using Talo!'
    this.mainText = `Your ${format(new Date(), 'MMMM yyyy')} invoice is ready.<br/><br/>The balance due is: <strong>${this.getPrice(invoice.amount_due)}</strong>.<br/><br/>The balance will be automatically charged to your card so you don't need to do anything.`

    this.ctaLink = invoice.hosted_invoice_url!
    this.ctaText = 'View invoice'

    this.why = 'You are receiving this email because your Talo subscription was updated'
  }

  private getPrice(amount: number): string {
    const d = dinero({ amount, currency: USD })
    const transformer = ({ value }: { value: unknown }) => `$${value}`
    return toDecimal(d, transformer)
  }
}
