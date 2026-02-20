import { apiRouter } from '../../../lib/routing/router'
import { confirmRoute } from './confirm'
import { deleteRoute } from './delete'
import { getSubscribersRoute } from './get-subscribers'
import { getSubscriptionsRoute } from './get-subscriptions'
import { postRoute } from './post'

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
