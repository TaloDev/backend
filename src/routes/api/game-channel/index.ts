import { RouterGroup } from '../../../lib/routing/router-group.js'
import { apiRouter } from '../../../lib/routing/router.js'
import { deleteRoute } from './delete.js'
import { getStorageRoute } from './get-storage.js'
import { getRoute } from './get.js'
import { inviteRoute } from './invite.js'
import { joinRoute } from './join.js'
import { leaveRoute } from './leave.js'
import { listStorageRoute } from './list-storage.js'
import { listRoute } from './list.js'
import { membersRoute } from './members.js'
import { postRoute } from './post.js'
import { putStorageRoute } from './put-storage.js'
import { putRoute } from './put.js'
import { subscriptionsRoute } from './subscriptions.js'

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
