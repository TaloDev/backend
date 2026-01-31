import { protectedRouter, protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { loadGame } from '../../../middleware/game-middleware'
import { UserType } from '../../../entities/user'
import GameActivity from '../../../entities/game-activity'

export function gameActivityRouter() {
  return protectedRouter('/games/:gameId/game-activities', ({ route }) => {
    route(protectedRoute({
      method: 'get',
      middleware: withMiddleware(userTypeGate([UserType.ADMIN, UserType.DEMO], 'view game activities'), loadGame),
      handler: async (ctx) => {
        const em = ctx.em
        const game = ctx.state.game

        const activities = await em.repo(GameActivity).find({
          $or: [
            { game },
            {
              $and: [
                {
                  game: null,
                  user: {
                    organisation: ctx.state.user.organisation
                  }
                }
              ]
            }
          ]
        }, {
          populate: ['user']
        })

        return {
          status: 200,
          body: {
            activities
          }
        }
      }
    }))
  })
}
