import { protectedRouter } from '../../../lib/routing/router.js'
import { createRoute } from './create.js'
import { deleteRoute } from './delete.js'
import { entriesRoute } from './entries.js'
import { listRoute } from './list.js'
import { resetRoute } from './reset.js'
import { updateEntryRoute } from './update-entry.js'
import { updateRoute } from './update.js'

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
