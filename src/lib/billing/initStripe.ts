import Stripe from 'stripe'

export const stripeVersion = '2025-03-31.basil'

export default function initStripe(): Stripe | null {
  if (!process.env.STRIPE_KEY) {
    return null
  }

  const opts: Stripe.StripeConfig = { apiVersion: stripeVersion }
  if (process.env.NODE_ENV === 'test') {
    opts.protocol = 'http'
    opts.host = 'localhost'
    opts.port = 12111
  }

  return new Stripe(process.env.STRIPE_KEY, opts)
}
