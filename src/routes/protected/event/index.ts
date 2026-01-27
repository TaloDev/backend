import { protectedRouter } from '../../../lib/routing/router'
import { listRoute } from './list'
import { breakdownRoute } from './breakdown'

export function eventRouter() {
  return protectedRouter('/games/:gameId/events', ({ route }) => {
    route(listRoute)
    route(breakdownRoute)
  })
}
