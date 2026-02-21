import { protectedRouter } from '../../../lib/routing/router'
import { authActivitiesRoute } from './auth-activities'
import { deleteRoute } from './delete'
import { eventsRoute } from './events'
import { getRoute } from './get'
import { listRoute } from './list'
import { savesRoute } from './saves'
import { statsRoute } from './stats'
import { updateRoute } from './update'

export function playerRouter() {
  return protectedRouter('/games/:gameId/players', ({ route }) => {
    route(listRoute)
    route(getRoute)
    route(updateRoute)
    route(deleteRoute)
    route(eventsRoute)
    route(statsRoute)
    route(savesRoute)
    route(authActivitiesRoute)
  })
}
