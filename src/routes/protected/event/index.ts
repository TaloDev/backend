import { protectedRouter } from '../../../lib/routing/router'
import { breakdownRoute } from './breakdown'
import { listRoute } from './list'

export function eventRouter() {
  return protectedRouter('/games/:gameId/events', ({ route }) => {
    route(listRoute)
    route(breakdownRoute)
  })
}
