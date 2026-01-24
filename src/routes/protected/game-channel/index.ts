import { protectedRouter } from '../../../lib/routing/router'
import { listRoute } from './list'
import { createRoute } from './create'
import { updateRoute } from './update'
import { deleteRoute } from './delete'
import { storageRoute } from './storage'

export function gameChannelRouter() {
  return protectedRouter('/games/:gameId/game-channels', ({ route }) => {
    route(listRoute)
    route(createRoute)
    route(updateRoute)
    route(deleteRoute)
    route(storageRoute)
  })
}
