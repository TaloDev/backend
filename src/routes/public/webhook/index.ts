import type Router from 'koa-tree-router'
import { publicRouter } from '../../../lib/routing/router.js'
import { subscriptionsRoute } from './subscriptions.js'

export function webhookRouter(router: Router) {
  publicRouter(
    '/public/webhooks',
    ({ route }) => {
      route(subscriptionsRoute)
    },
    { router },
  )
}
