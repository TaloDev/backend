import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import PlayerGroup from '../../../entities/player-group'

export const listRoute = protectedRoute({
  method: 'get',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const em = ctx.em
    const groups = await em.repo(PlayerGroup).find({ game: ctx.state.game })

    return {
      status: 200,
      body: {
        groups: await Promise.all(groups.map((group) => {
          return group.toJSONWithCount(ctx.state.includeDevData)
        }))
      }
    }
  }
})
