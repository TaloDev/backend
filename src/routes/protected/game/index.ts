import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { createRoute } from './create.js'
import { settingsRoute } from './settings.js'
import { updateRoute } from './update.js'

export function gameRouter(router: Router) {
  protectedRouter(
    '/games',
    ({ route }) => {
      route(settingsRoute)
      route(createRoute)
      route(updateRoute)
    },
    { router },
  )
}
