import Stripe from 'stripe'

export default function initStripe(): Stripe {
  return new Stripe(process.env.STRIPE_KEY, { apiVersion: '2020-08-27' })
}
