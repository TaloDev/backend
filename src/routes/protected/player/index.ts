import { protectedRouter } from '../../../lib/routing/router'
import { listRoute } from './list'
import { getRoute } from './get'
import { updateRoute } from './update'
import { deleteRoute } from './delete'
import { eventsRoute } from './events'
import { statsRoute } from './stats'
import { savesRoute } from './saves'
import { authActivitiesRoute } from './auth-activities'

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
