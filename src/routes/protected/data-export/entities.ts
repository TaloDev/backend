import { DataExportAvailableEntities } from '../../../entities/data-export.js'
import { protectedRoute } from '../../../lib/routing/router.js'

export const entitiesRoute = protectedRoute({
  method: 'get',
  path: '/entities',
  handler: () => {
    const entities = Object.values(DataExportAvailableEntities)

    return {
      status: 200,
      body: {
        entities,
      },
    }
  },
})
