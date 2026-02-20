import { protectedRouter } from '../../../lib/routing/router'
import { createRoute } from './create'
import { listRoute } from './list'

export function inviteRouter() {
  return protectedRouter('/invites', ({ route }) => {
    route(listRoute)
    route(createRoute)
  })
}
