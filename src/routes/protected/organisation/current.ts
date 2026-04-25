import Game from '../../../entities/game'
import Invite from '../../../entities/invite'
import Player from '../../../entities/player'
import User, { UserType } from '../../../entities/user'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'

export const currentRoute = protectedRoute({
  method: 'get',
  path: '/current',
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'view organisation info')),
  handler: async (ctx) => {
    const em = ctx.em
    const organisation = ctx.state.user.organisation

    const games = await em.repo(Game).find({ organisation })
    const playerCountMap = new Map<number, number>()

    for (const game of games) {
      const playerCount = await em.repo(Player).count({ game })
      playerCountMap.set(game.id, playerCount)
    }

    const members = await em.repo(User).find({ organisation })
    const pendingInvites = await em.repo(Invite).find({ organisation })

    return {
      status: 200,
      body: {
        games: games.map((game) => ({
          ...game.toJSON(),
          playerCount: playerCountMap.get(game.id),
        })),
        members,
        pendingInvites,
      },
    }
  },
})
