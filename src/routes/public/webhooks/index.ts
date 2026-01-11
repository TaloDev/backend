import { publicRouter } from '../../../lib/routing/router'
import { subscriptionsRoute } from './subscriptions'

export function webhooksRouter() {
  return publicRouter('/public/webhooks', ({ route }) => {
    route(subscriptionsRoute)
  })
}
