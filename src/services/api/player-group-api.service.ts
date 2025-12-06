import { HasPermission, Request, Response, Route, Validate } from 'koa-clay'
import APIService from './api-service'
import PlayerGroupAPIPolicy from '../../policies/api/player-group-api.policy'
import PlayerGroup from '../../entities/player-group'
import Player from '../../entities/player'
import { PlayerGroupAPIDocs } from '../../docs/player-group-api.docs'
import { EntityManager } from '@mikro-orm/mysql'
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination/itemsPerPage'
import { pageValidation } from '../../lib/pagination/pageValidation'

type PlayerGroupWithCountAndMembers = Pick<PlayerGroup, 'id' | 'name' | 'description' | 'rules' | 'ruleMode' | 'updatedAt'> & { count: number, members?: Player[] }

export default class PlayerGroupAPIService extends APIService {
  @Route({
    method: 'GET',
    path: '/:id',
    docs: PlayerGroupAPIDocs.get
  })
  @Validate({
    query: {
      membersPage: pageValidation
    }
  })
  @HasPermission(PlayerGroupAPIPolicy, 'get')
  async get(req: Request): Promise<Response> {
    const itemsPerPage = DEFAULT_PAGE_SIZE
    const { membersPage = 0 } = req.query
    const em: EntityManager = req.ctx.em
    const group: PlayerGroup = req.ctx.state.group

    const groupWithCountAndMembers: PlayerGroupWithCountAndMembers = await group.toJSONWithCount(req.ctx.state.includeDevData)

    let isLastPage = true
    let paginationCount = 0
    if (group.membersVisible) {
      const [members, count] = await em.repo(Player).findAndCount({
        ...(req.ctx.state.includeDevData ? {} : { devBuild: false }),
        groups: {
          $some: group
        }
      }, {
        limit: itemsPerPage + 1,
        offset: Number(membersPage) * itemsPerPage
      })

      groupWithCountAndMembers.members = members.slice(0, itemsPerPage)
      paginationCount = count
      isLastPage = members.length <= itemsPerPage
    }

    return {
      status: 200,
      body: {
        group: groupWithCountAndMembers,
        membersPagination: {
          count: paginationCount,
          itemsPerPage,
          isLastPage
        }
      }
    }
  }
}
