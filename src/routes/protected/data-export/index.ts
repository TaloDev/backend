import { protectedRouter } from '../../../lib/routing/router'
import { listRoute } from './list'
import { createRoute } from './create'
import { entitiesRoute } from './entities'

export function dataExportRouter() {
  return protectedRouter('/games/:gameId/data-exports', ({ route }) => {
    route(listRoute)
    route(createRoute)
    route(entitiesRoute)
  })
}
