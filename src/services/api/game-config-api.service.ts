import { HasPermission, Request, Response, Route } from 'koa-clay'
import GameConfigAPIPolicy from '../../policies/api/game-config-api.policy'
import APIService from './api-service'
import { EntityManager } from '@mikro-orm/mysql'
import GameConfigAPIDocs from '../../docs/game-config-api.docs'
import Game from '../../entities/game'
import { getResultCacheOptions } from '../../lib/perf/getResultCacheOptions'

export default class GameConfigAPIService extends APIService {
  @Route({
    method: 'GET',
    docs: GameConfigAPIDocs.index
  })
  @HasPermission(GameConfigAPIPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)
    const cacheKey = Game.getLiveConfigCacheKey(key.game)

    const game = await em
      .fork()
      .repo(Game)
      .findOneOrFail(key.game, {
        ...getResultCacheOptions(cacheKey, 600_000),
        fields: ['props']
      })

    return {
      status: 200,
      body: {
        config: game.getLiveConfig()
      }
    }
  }
}
