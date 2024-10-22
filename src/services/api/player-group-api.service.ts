import { HasPermission, Request, Response, Docs } from 'koa-clay'
import APIService from './api-service'
import PlayerGroupAPIPolicy from '../../policies/api/player-group-api.policy'
import PlayerGroup from '../../entities/player-group'
import Player from '../../entities/player'
import PlayerGroupAPIDocs from '../../docs/player-group-api.docs'
import { EntityManager } from '@mikro-orm/mysql'
import { devDataPlayerFilter } from '../../middlewares/dev-data-middleware'

type PlayerGroupWithCountAndMembers = Pick<PlayerGroup, 'id' | 'name' | 'description' | 'rules' | 'ruleMode' | 'updatedAt'> & { count: number, members?: Player[] }

export default class PlayerGroupAPIService extends APIService {
  @HasPermission(PlayerGroupAPIPolicy, 'get')
  @Docs(PlayerGroupAPIDocs.get)
  async get(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const group: PlayerGroup = req.ctx.state.group

    const groupWithCountAndMembers: PlayerGroupWithCountAndMembers = await group.toJSONWithCount(em, req.ctx.state.includeDevData)
    if (group.membersVisible) {
      groupWithCountAndMembers.members = await group.members.loadItems({
        where: req.ctx.state.includeDevData ? {} : devDataPlayerFilter(em)
      })
    }

    return {
      status: 200,
      body: {
        group: groupWithCountAndMembers
      }
    }
  }
}
