import { protectedRouter } from '../../../lib/routing/router'
import { listRoute } from './list'
import { createRoute } from './create'

export function inviteRouter() {
  return protectedRouter('/invites', ({ route }) => {
    route(listRoute)
    route(createRoute)
  })
}
