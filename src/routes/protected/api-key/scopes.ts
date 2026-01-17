import { protectedRoute } from '../../../lib/routing/router'
import { APIKeyScope } from '../../../entities/api-key'
import { groupBy } from 'lodash'

type ScopeKey = keyof typeof APIKeyScope

export const scopesRoute = protectedRoute({
  method: 'get',
  path: '/scopes',
  handler: () => {
    const scopes = Object.keys(APIKeyScope)
      .filter((key) => APIKeyScope[key as ScopeKey] !== APIKeyScope.FULL_ACCESS)
      .map((key) => APIKeyScope[key as ScopeKey])

    return {
      status: 200,
      body: {
        scopes: groupBy(scopes, (scope) => scope.split(':')[1])
      }
    }
  }
})
