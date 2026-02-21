import { apiRouter } from '../../../lib/routing/router'
import { RouterGroup } from '../../../lib/routing/router-group'
import { deleteRoute } from './delete'
import { getRoute } from './get'
import { getStorageRoute } from './get-storage'
import { inviteRoute } from './invite'
import { joinRoute } from './join'
import { leaveRoute } from './leave'
import { listRoute } from './list'
import { listStorageRoute } from './list-storage'
import { membersRoute } from './members'
import { postRoute } from './post'
import { putRoute } from './put'
import { putStorageRoute } from './put-storage'
import { subscriptionsRoute } from './subscriptions'

export function gameChannelAPIRouter() {
  const opts = {
    docsKey: 'GameChannelAPI',
  }

  return new RouterGroup([
    // static routes - mounted first so /subscriptions
    // is checked before /:id
    apiRouter(
      '/v1/game-channels',
      ({ route }) => {
        route(listRoute)
        route(postRoute)
        route(subscriptionsRoute)
      },
      opts,
    ),
    // parameterized routes with nested paths
    apiRouter(
      '/v1/game-channels',
      ({ route }) => {
        route(joinRoute)
        route(leaveRoute)
        route(inviteRoute)
        route(membersRoute)
        route(listStorageRoute)
        route(getStorageRoute)
        route(putStorageRoute)
        route(getRoute)
        route(putRoute)
        route(deleteRoute)
      },
      opts,
    ),
  ])
}
