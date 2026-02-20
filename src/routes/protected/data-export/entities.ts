import { DataExportAvailableEntities } from '../../../entities/data-export'
import { protectedRoute } from '../../../lib/routing/router'

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
