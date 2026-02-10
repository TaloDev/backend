import { apiRouter } from '../../../lib/routing/router'
import { postRoute } from './post'
import { confirmRoute } from './confirm'
import { getSubscribersRoute } from './get-subscribers'
import { getSubscriptionsRoute } from './get-subscriptions'
import { deleteRoute } from './delete'

export function playerRelationshipAPIRouter() {
  return apiRouter('/v1/players/relationships', ({ route }) => {
    route(postRoute)
    route(confirmRoute)
    route(getSubscribersRoute)
    route(getSubscriptionsRoute)
    route(deleteRoute)
  }, {
    docsKey: 'PlayerRelationshipsAPI'
  })
}
