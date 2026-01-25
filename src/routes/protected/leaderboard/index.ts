import { protectedRouter } from '../../../lib/routing/router'
import { listRoute } from './list'
import { createRoute } from './create'
import { entriesRoute } from './entries'
import { updateEntryRoute } from './update-entry'
import { updateRoute } from './update'
import { deleteRoute } from './delete'
import { resetRoute } from './reset'

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
