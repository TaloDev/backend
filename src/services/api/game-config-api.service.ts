import { HasPermission, Request, Response, Docs } from 'koa-clay'
import GameConfigAPIPolicy from '../../policies/api/game-config-api.policy'
import APIService from './api-service'
import { EntityManager } from '@mikro-orm/mysql'
import GameConfigAPIDocs from '../../docs/game-config-api.docs'

export default class GameConfigAPIService extends APIService {
  @HasPermission(GameConfigAPIPolicy, 'index')
  @Docs(GameConfigAPIDocs.index)
  async index(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)
    await em.populate(key, ['game'])

    const config = key.game.props.filter((prop) => !prop.key.startsWith('META_'))

    return {
      status: 200,
      body: {
        config
      }
    }
  }
}
