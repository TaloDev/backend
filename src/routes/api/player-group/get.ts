import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import Player from '../../../entities/player'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'
import { pageSchema } from '../../../lib/validation/pageSchema'
import { loadGroup } from './common'
import { getDocs } from './docs'
import PlayerGroup from '../../../entities/player-group'

export type HydratedGroup = Awaited<ReturnType<PlayerGroup['toJSONWithCount']>> & { members?: Player[] }

const itemsPerPage = DEFAULT_PAGE_SIZE

export const getRoute = apiRoute({
  method: 'get',
  path: '/:id',
  docs: getDocs,
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYER_GROUPS]),
    loadGroup
  ),
  schema: (z) => ({
    route: z.object({
      id: z.string().meta({ description: 'The ID of the group' })
    }),
    query: z.object({
      membersPage: pageSchema.meta({ description: 'The current pagination index for group members (starting at 0)' })
    })
  }),
  handler: async (ctx) => {
    const group = ctx.state.group
    const { membersPage } = ctx.state.validated.query

    const hydratedGroup: HydratedGroup = await group.toJSONWithCount(ctx.state.includeDevData)

    let paginationCount = 0
    let isLastPage = true

    if (group.membersVisible) {
      const [members, count] = await ctx.em.repo(Player).findAndCount({
        ...(ctx.state.includeDevData ? {} : { devBuild: false }),
        groups: {
          $some: group
        }
      }, {
        limit: itemsPerPage + 1,
        offset: membersPage * itemsPerPage
      })

      hydratedGroup.members = members.slice(0, itemsPerPage)
      paginationCount = count
      isLastPage = members.length <= itemsPerPage
    }

    return {
      status: 200,
      body: {
        group: hydratedGroup,
        membersPagination: {
          count: paginationCount,
          itemsPerPage,
          isLastPage
        }
      }
    }
  }
})
