import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { createRoute } from './create.js'
import { deleteRoute } from './delete.js'
import { listRoute } from './list.js'
import { storageRoute } from './storage.js'
import { updateRoute } from './update.js'

export function gameChannelRouter(router: Router) {
  protectedRouter(
    '/games/:gameId/game-channels',
    ({ route }) => {
      route(listRoute)
      route(createRoute)
      route(updateRoute)
      route(deleteRoute)
      route(storageRoute)
    },
    { router },
  )
}
