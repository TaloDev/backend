import { EntityManager, FilterQuery } from '@mikro-orm/mysql'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import Leaderboard from '../../../entities/leaderboard'
import Game from '../../../entities/game'

type ListLeaderboardsParams = {
  em: EntityManager
  game: Game
  internalName?: string
}

export async function listLeaderboardsHandler({ em, game, internalName }: ListLeaderboardsParams) {
  const where: FilterQuery<Leaderboard> = { game }

  if (internalName) {
    where.internalName = internalName
  }

  const leaderboards = await em.repo(Leaderboard).find(where)

  return {
    status: 200,
    body: {
      leaderboards
    }
  }
}

export const listRoute = protectedRoute({
  method: 'get',
  schema: (z) => ({
    query: z.object({
      internalName: z.string().optional()
    })
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { internalName } = ctx.state.validated.query

    return listLeaderboardsHandler({
      em: ctx.em,
      game: ctx.state.game,
      internalName
    })
  }
})
