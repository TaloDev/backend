import { APIKeyScope } from '../../../entities/api-key.js'
import PlayerGroup from '../../../entities/player-group.js'
import Player from '../../../entities/player.js'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { pageSchema } from '../../../lib/validation/pageSchema.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { loadGroup } from './common.js'
import { getDocs } from './docs.js'

export type HydratedGroup = Awaited<ReturnType<PlayerGroup['toJSONWithCount']>> & {
  members?: Player[]
}

const itemsPerPage = DEFAULT_PAGE_SIZE

export const getRoute = apiRoute({
  method: 'get',
  path: '/:id',
  docs: getDocs,
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_PLAYER_GROUPS]), loadGroup),
  schema: (z) => ({
    route: z.object({
      id: z.uuid().meta({ description: 'The ID of the group' }),
    }),
    query: z.object({
      membersPage: pageSchema.meta({
        description: 'The current pagination index for group members (starting at 0)',
      }),
    }),
  }),
  handler: async (ctx) => {
    const group = ctx.state.group
    const { membersPage } = ctx.state.validated.query

    const counts = await PlayerGroup.getManyCounts({
      em: ctx.em,
      groupIds: [group.id],
      includeDevData: ctx.state.includeDevData,
    })
    const hydratedGroup: HydratedGroup = group.toJSONWithCount(counts)

    let paginationCount = 0
    let isLastPage = true

    if (group.membersVisible) {
      const [members, count] = await ctx.em.repo(Player).findAndCount(
        {
          ...(ctx.state.includeDevData ? {} : { devBuild: false }),
          groups: {
            $some: group,
          },
        },
        {
          limit: itemsPerPage + 1,
          offset: membersPage * itemsPerPage,
        },
      )

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
          isLastPage,
        },
      },
    }
  },
})
