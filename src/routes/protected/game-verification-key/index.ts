import { protectedRouter } from '../../../lib/routing/router.js'
import { createRoute } from './create.js'
import { deleteRoute } from './delete.js'
import { listRoute } from './list.js'

export function gameVerificationKeyRouter() {
  return protectedRouter('/games/:gameId/verification-keys', ({ route }) => {
    route(listRoute)
    route(createRoute)
    route(deleteRoute)
  })
}
