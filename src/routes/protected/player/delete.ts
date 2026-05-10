import { GameActivityType } from '../../../entities/game-activity.js'
import Player from '../../../entities/player.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { deletePlayersFromDB } from '../../../tasks/deletePlayers.js'
import { loadPlayer } from './common.js'

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'delete players'),
    loadGame,
    loadPlayer,
  ),
  handler: async (ctx) => {
    const player = ctx.state.player
    const game = player.game
    const em = ctx.em

    await deletePlayersFromDB(em, [player])

    createGameActivity(em, {
      user: ctx.state.user,
      game,
      type: GameActivityType.PLAYER_DELETED,
      extra: {
        playerId: player.id,
        display: {
          'Player ID': player.id,
        },
      },
    })

    await em.flush()
    await deferClearResponseCache(Player.getSearchCacheKey(game, true))

    return {
      status: 204,
    }
  },
})
