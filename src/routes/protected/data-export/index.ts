import { protectedRouter } from '../../../lib/routing/router.js'
import { createRoute } from './create.js'
import { entitiesRoute } from './entities.js'
import { listRoute } from './list.js'

export function dataExportRouter() {
  return protectedRouter('/games/:gameId/data-exports', ({ route }) => {
    route(listRoute)
    route(createRoute)
    route(entitiesRoute)
  })
}
