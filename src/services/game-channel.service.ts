import { EntityManager, QueryOrder } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate } from 'koa-clay'
import GameChannel from '../entities/game-channel'
import GameChannelPolicy from '../policies/game-channel.policy'

const itemsPerPage = 50

export default class GameChannelService extends Service {
  @Validate({ query: ['page'] })
  @HasPermission(GameChannelPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const { search, page } = req.query
    const em: EntityManager = req.ctx.em

    const query = em.qb(GameChannel, 'gc')
      .select('gc.*')
      .orderBy({ totalMessages: QueryOrder.DESC })
      .limit(itemsPerPage)
      .offset(Number(page) * itemsPerPage)

    if (search) {
      query.andWhere({
        $or: [
          { name: { $like: `%${search}%` } },
          {
            owner: { identifier: { $like: `%${search}%` } }
          }
        ]
      })
    }

    const [channels, count] = await query
      .andWhere({
        game: req.ctx.state.game
      })
      .getResultAndCount()

    await em.populate(channels, ['owner'])

    return {
      status: 200,
      body: {
        channels: await Promise.all(channels.map((channel) => channel.toJSONWithCount(em, req.ctx.state.includeDevData))),
        count,
        itemsPerPage
      }
    }
  }
}
