import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { ownerGate } from '../../../middleware/policy-middleware.js'

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
          blockAliasIdentifierProfanity: game.blockAliasIdentifierProfanity,
          blockPropsProfanity: game.blockPropsProfanity,
          website: game.website,
          gameToken: game.getToken(),
        },
      },
    }
  },
})
