import { Service } from 'koa-clay'
import { Context } from 'koa'
import APIKey from '../../entities/api-key'
import { EntityManager } from '@mikro-orm/mysql'

export default class APIService extends Service {
  async getAPIKey(ctx: Context): Promise<APIKey> {
    const key = await (<EntityManager>ctx.em).getRepository(APIKey).findOneOrFail(ctx.state.user.sub)
    return key
  }
}
