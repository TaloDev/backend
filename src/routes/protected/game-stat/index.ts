import { protectedRouter } from '../../../lib/routing/router'
import { createRoute } from './create'
import { deleteRoute } from './delete'
import { listRoute } from './list'
import { resetRoute } from './reset'
import { updateRoute } from './update'
import { updatePlayerStatRoute } from './update-player-stat'

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
