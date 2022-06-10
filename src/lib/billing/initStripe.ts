import Stripe from 'stripe'

export default function initStripe(): Stripe {
  const opts: Stripe.StripeConfig = { apiVersion: '2020-08-27' }
  if (process.env.NODE_ENV === 'test') {
    opts.protocol = 'http'
    opts.host = 'localhost'
    opts.port = 12111
  }

  return new Stripe(process.env.STRIPE_KEY, opts)
}
