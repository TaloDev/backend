import { protectedRouter } from '../../../lib/routing/router.js'
import { authActivitiesRoute } from './auth-activities.js'
import { deleteRoute } from './delete.js'
import { eventsRoute } from './events.js'
import { getRoute } from './get.js'
import { listRoute } from './list.js'
import { savesRoute } from './saves.js'
import { statsRoute } from './stats.js'
import { updateRoute } from './update.js'

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
