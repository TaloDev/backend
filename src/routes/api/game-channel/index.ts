import { apiRouter } from '../../../lib/routing/router'
import { RouterGroup } from '../../../lib/routing/router-group'
import { listRoute } from './list'
import { subscriptionsRoute } from './subscriptions'
import { getRoute } from './get'
import { postRoute } from './post'
import { joinRoute } from './join'
import { leaveRoute } from './leave'
import { putRoute } from './put'
import { deleteRoute } from './delete'
import { inviteRoute } from './invite'
import { membersRoute } from './members'
import { getStorageRoute } from './get-storage'
import { listStorageRoute } from './list-storage'
import { putStorageRoute } from './put-storage'

export function gameChannelAPIRouter() {
  const opts = {
    docsKey: 'GameChannelAPI'
  }

  return new RouterGroup([
    // static routes - mounted first so /subscriptions
    // is checked before /:id
    apiRouter('/v1/game-channels', ({ route }) => {
      route(listRoute)
      route(postRoute)
      route(subscriptionsRoute)
    }, opts),
    // parameterized routes with nested paths
    apiRouter('/v1/game-channels', ({ route }) => {
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
    }, opts)
  ])
}
