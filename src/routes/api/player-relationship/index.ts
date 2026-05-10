import { apiRouter } from '../../../lib/routing/router.js'
import { confirmRoute } from './confirm.js'
import { deleteRoute } from './delete.js'
import { getSubscribersRoute } from './get-subscribers.js'
import { getSubscriptionsRoute } from './get-subscriptions.js'
import { postRoute } from './post.js'

export function playerRelationshipAPIRouter() {
  return apiRouter(
    '/v1/players/relationships',
    ({ route }) => {
      route(postRoute)
      route(confirmRoute)
      route(getSubscribersRoute)
      route(getSubscriptionsRoute)
      route(deleteRoute)
    },
    {
      docsKey: 'PlayerRelationshipsAPI',
    },
  )
}
