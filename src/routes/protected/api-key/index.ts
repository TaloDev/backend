import { protectedRouter } from '../../../lib/routing/router.js'
import { createRoute } from './create.js'
import { listRoute } from './list.js'
import { revokeRoute } from './revoke.js'
import { scopesRoute } from './scopes.js'
import { updateRoute } from './update.js'

export function apiKeyRouter() {
  return protectedRouter('/games/:gameId/api-keys', ({ route }) => {
    route(createRoute)
    route(listRoute)
    route(scopesRoute)
    route(revokeRoute)
    route(updateRoute)
  })
}
