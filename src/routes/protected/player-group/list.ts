import PlayerGroup from '../../../entities/player-group'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'

export const listRoute = protectedRoute({
  method: 'get',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const em = ctx.em
    const includeDevData = ctx.state.includeDevData

    const groups = await em.repo(PlayerGroup).find({ game: ctx.state.game })
    const counts = await PlayerGroup.getManyCounts({
      em,
      groupIds: groups.map((g) => g.id),
      includeDevData,
    })

    return {
      status: 200,
      body: {
        groups: groups.map((g) => g.toJSONWithCount(counts)),
      },
    }
  },
})
