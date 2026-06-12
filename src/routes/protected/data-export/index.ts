import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { createRoute } from './create.js'
import { entitiesRoute } from './entities.js'
import { listRoute } from './list.js'

export function dataExportRouter(router: Router) {
  protectedRouter(
    '/games/:gameId/data-exports',
    ({ route }) => {
      route(listRoute)
      route(createRoute)
      route(entitiesRoute)
    },
    { router },
  )
}
