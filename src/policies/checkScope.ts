import APIKey, { APIKeyScope } from '../entities/api-key.js'

export default function checkScope(key: APIKey, scope: APIKeyScope): boolean {
  return key.scopes.includes(APIKeyScope.FULL_ACCESS) || key.scopes.includes(scope)
}
