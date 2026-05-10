import { protectedRouter } from '../../../lib/routing/router.js'
import { createRoute } from './create.js'
import { listRoute } from './list.js'

export function inviteRouter() {
  return protectedRouter('/invites', ({ route }) => {
    route(listRoute)
    route(createRoute)
  })
}
