import { protectedRouter } from '../../../lib/routing/router'
import { createRoute } from './create'
import { deleteRoute } from './delete'
import { listRoute } from './list'
import { storageRoute } from './storage'
import { updateRoute } from './update'

export function gameChannelRouter() {
  return protectedRouter('/games/:gameId/game-channels', ({ route }) => {
    route(listRoute)
    route(createRoute)
    route(updateRoute)
    route(deleteRoute)
    route(storageRoute)
  })
}
