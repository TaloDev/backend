import { protectedRouter } from '../../../lib/routing/router.js'
import { breakdownRoute } from './breakdown.js'
import { listRoute } from './list.js'

export function eventRouter() {
  return protectedRouter('/games/:gameId/events', ({ route }) => {
    route(listRoute)
    route(breakdownRoute)
  })
}
