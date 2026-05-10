import { protectedRouter } from '../../../lib/routing/router.js'
import { bulkCreateRoute } from './bulk-create.js'
import { createRoute } from './create.js'
import { deleteRoute } from './delete.js'
import { listRoute } from './list.js'
import { resetRoute } from './reset.js'
import { updatePlayerStatRoute } from './update-player-stat.js'
import { updateRoute } from './update.js'

export function gameStatRouter() {
  return protectedRouter('/games/:gameId/game-stats', ({ route }) => {
    route(listRoute)
    route(createRoute)
    route(bulkCreateRoute)
    route(updateRoute)
    route(deleteRoute)
    route(updatePlayerStatRoute)
    route(resetRoute)
  })
}
