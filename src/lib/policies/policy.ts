import { EntityManager } from '@mikro-orm/core'
import { Context } from 'vm'
import APIKey from '../../entities/api-key'
import User from '../../entities/user'

export default class Policy {
  ctx: Context

  constructor(ctx: Context) {
    this.ctx = ctx
  }

  isAPICall(): boolean {
    return this.ctx.state.user.api === true
  }

  async getUser(): Promise<User> {
    const user = await (<EntityManager>this.ctx.em).getRepository(User).findOne(this.ctx.state.user.sub)
    return user
  }

  getSub(): number {
    return this.ctx.state.user.sub
  }

  async getAPIKey(): Promise<APIKey> {
    const key = await (<EntityManager>this.ctx.em).getRepository(APIKey).findOne(this.ctx.state.user.sub)
    return key
  }
}
