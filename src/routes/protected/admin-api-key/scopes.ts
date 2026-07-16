import { groupBy } from 'lodash-es'
import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { protectedRoute } from '../../../lib/routing/router.js'

type ScopeKey = keyof typeof AdminAPIKeyScope

export const scopesRoute = protectedRoute({
  method: 'get',
  path: '/scopes',
  handler: () => {
    const scopes = Object.keys(AdminAPIKeyScope)
      .filter((key) => AdminAPIKeyScope[key as ScopeKey] !== AdminAPIKeyScope.FULL_ACCESS)
      .map((key) => AdminAPIKeyScope[key as ScopeKey])

    return {
      status: 200,
      body: {
        scopes: groupBy(scopes, (scope) => scope.split(':')[1]),
      },
    }
  },
})
