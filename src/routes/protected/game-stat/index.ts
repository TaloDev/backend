import { protectedRouter } from '../../../lib/routing/router'
import { listRoute } from './list'
import { createRoute } from './create'
import { updateRoute } from './update'
import { deleteRoute } from './delete'
import { updatePlayerStatRoute } from './update-player-stat'
import { resetRoute } from './reset'

export function gameStatRouter() {
  return protectedRouter('/games/:gameId/game-stats', ({ route }) => {
    route(listRoute)
    route(createRoute)
    route(updateRoute)
    route(deleteRoute)
    route(updatePlayerStatRoute)
    route(resetRoute)
  })
}
