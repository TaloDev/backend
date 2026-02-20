import { protectedRouter } from '../../../lib/routing/router'
import { createRoute } from './create'
import { listRoute } from './list'
import { revokeRoute } from './revoke'
import { scopesRoute } from './scopes'
import { updateRoute } from './update'

export function apiKeyRouter() {
  return protectedRouter('/games/:gameId/api-keys', ({ route }) => {
    route(createRoute)
    route(listRoute)
    route(scopesRoute)
    route(revokeRoute)
    route(updateRoute)
  })
}
