import { protectedRouter } from '../../../lib/routing/router'
import { createRoute } from './create'
import { entitiesRoute } from './entities'
import { listRoute } from './list'

export function dataExportRouter() {
  return protectedRouter('/games/:gameId/data-exports', ({ route }) => {
    route(listRoute)
    route(createRoute)
    route(entitiesRoute)
  })
}
