import Stripe from 'stripe'

export default function initStripe(): Stripe | null {
  if (!process.env.STRIPE_KEY) {
    return null
  }

  const opts: Stripe.StripeConfig = { apiVersion: '2025-02-24.acacia' }
  if (process.env.NODE_ENV === 'test') {
    opts.protocol = 'http'
    opts.host = 'localhost'
    opts.port = 12111
  }

  return new Stripe(process.env.STRIPE_KEY, opts)
}
