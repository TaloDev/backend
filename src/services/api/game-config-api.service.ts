import { HasPermission, Request, Response, Route } from 'koa-clay'
import GameConfigAPIPolicy from '../../policies/api/game-config-api.policy'
import APIService from './api-service'
import { EntityManager } from '@mikro-orm/mysql'
import GameConfigAPIDocs from '../../docs/game-config-api.docs'
import { TraceService } from '../../lib/routing/trace-service'

@TraceService()
export default class GameConfigAPIService extends APIService {
  @Route({
    method: 'GET',
    docs: GameConfigAPIDocs.index
  })
  @HasPermission(GameConfigAPIPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)
    await em.populate(key, ['game'])

    return {
      status: 200,
      body: {
        config: key.game.getLiveConfig()
      }
    }
  }
}
