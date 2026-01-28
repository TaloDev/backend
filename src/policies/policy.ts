import { EntityManager } from '@mikro-orm/mysql'
import { Policy as ServicePolicy, PolicyDenial, PolicyResponse } from 'koa-clay'
import { Context } from 'koa'
import APIKey, { APIKeyScope } from '../entities/api-key'
import checkScope from './checkScope'

export default class Policy extends ServicePolicy {
  em: EntityManager

  constructor(ctx: Context) {
    super(ctx)
    this.em = ctx.em
  }

  isAPICall(): boolean {
    return this.ctx.state.user.api === true
  }

  getAPIKey(): APIKey {
    return this.ctx.state.key
  }

  async hasScope(scope: APIKeyScope): Promise<PolicyResponse> {
    const key = this.getAPIKey()
    const hasScope = checkScope(key, scope)

    return hasScope || new PolicyDenial({ message: `Missing access key scope: ${scope}` })
  }

  async hasScopes(scopes: APIKeyScope[]): Promise<PolicyResponse> {
    const key = this.getAPIKey()
    const missing = scopes.filter((scope) => !checkScope(key, scope))

    return missing.length === 0 || new PolicyDenial({ message: `Missing access key scope(s): ${missing.join(', ')}` })
  }
}
