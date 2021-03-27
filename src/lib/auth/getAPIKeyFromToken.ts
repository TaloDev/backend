import { EntityManager } from '@mikro-orm/core'
import { Context } from 'koa'
import APIKey from '../../entities/api-key'

const getAPIKeyFromToken = async (ctx: Context, relations?: string[]): Promise<APIKey> => {
  const keyId: string = ctx.state.user.sub
  const key = await (<EntityManager>ctx.em).getRepository(APIKey).findOne(keyId, relations)
  return key
}

export default getAPIKeyFromToken
