import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response } from 'koa-clay'
import GameChannel from '../entities/game-channel'
import GameChannelPolicy from '../policies/game-channel.policy'

export default class GameChannelService extends Service {
  @HasPermission(GameChannelPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const channels = await em.getRepository(GameChannel).find({ game: req.ctx.state.game })

    return {
      status: 200,
      body: {
        channels: await Promise.all(channels.map((channel) => channel.toJSONWithCount(em, req.ctx.state.includeDevData)))
      }
    }
  }
}
