import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { ownerGate } from '../../../middleware/policy-middleware'

export const settingsRoute = protectedRoute({
  method: 'get',
  path: '/:gameId/settings',
  middleware: withMiddleware(ownerGate('view game settings'), loadGame),
  handler: (ctx) => {
    const game = ctx.state.game

    return {
      status: 200,
      body: {
        settings: {
          purgeDevPlayers: game.purgeDevPlayers,
          purgeLivePlayers: game.purgeLivePlayers,
          purgeDevPlayersRetention: game.purgeDevPlayersRetention,
          purgeLivePlayersRetention: game.purgeLivePlayersRetention,
          website: game.website,
        },
      },
    }
  },
})
