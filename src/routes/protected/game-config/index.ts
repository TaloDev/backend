import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { getRoute } from './get.js'
import { createScheduledChangeRoute } from './scheduled-changes/create.js'
import { deleteScheduledChangeRoute } from './scheduled-changes/delete.js'
import { listScheduledChangesRoute } from './scheduled-changes/list.js'
import { updateRoute } from './update.js'

export function gameConfigRouter(router: Router) {
  protectedRouter(
    '/games/:gameId/game-config',
    ({ route }) => {
      route(getRoute)
      route(updateRoute)
      route(listScheduledChangesRoute)
      route(createScheduledChangeRoute)
      route(deleteScheduledChangeRoute)
    },
    { router },
  )
}
