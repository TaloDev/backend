import { protectedRouter } from '../../../lib/routing/router'
import { createRoute } from './create'
import { deleteRoute } from './delete'
import { entriesRoute } from './entries'
import { listRoute } from './list'
import { resetRoute } from './reset'
import { updateRoute } from './update'
import { updateEntryRoute } from './update-entry'

export function leaderboardRouter() {
  return protectedRouter('/games/:gameId/leaderboards', ({ route }) => {
    route(listRoute)
    route(createRoute)
    route(updateRoute)
    route(deleteRoute)
    route(entriesRoute)
    route(updateEntryRoute)
    route(resetRoute)
  })
}
