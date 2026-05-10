import { publicRouter } from '../../../lib/routing/router.js'
import { subscriptionsRoute } from './subscriptions.js'

export function webhookRouter() {
  return publicRouter('/public/webhooks', ({ route }) => {
    route(subscriptionsRoute)
  })
}
