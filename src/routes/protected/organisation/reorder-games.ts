import Game from '../../../entities/game.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { ownerGate } from '../../../middleware/policy-middleware.js'

export const reorderGamesRoute = protectedRoute({
  method: 'put',
  path: '/games/order',
  schema: (z) => ({
    body: z.object({
      gameIds: z.array(z.number().int().positive()),
    }),
  }),
  middleware: withMiddleware(ownerGate('reorder games')),
  handler: async (ctx) => {
    const { gameIds } = ctx.state.validated.body
    const em = ctx.em
    const organisation = ctx.state.user.organisation

    const games = await em.repo(Game).find({ organisation })
    const gamesById = new Map(games.map((game) => [game.id, game]))
    const orderedGames = gameIds.flatMap((gameId) => {
      const game = gamesById.get(gameId)
      return game ? [game] : []
    })

    orderedGames.forEach((game, index) => {
      game.switcherOrder = index
    })
    await em.flush()

    return {
      status: 200,
      body: {
        games: orderedGames,
      },
    }
  },
})
