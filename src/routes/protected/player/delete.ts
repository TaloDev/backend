import Player from '../../../entities/player'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import { deletePlayersFromDB } from '../../../tasks/deletePlayers'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue'
import { loadPlayer } from './common'
import { loadGame } from '../../../middleware/game-middleware'

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'delete players'),
    loadGame,
    loadPlayer
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
          'Player ID': player.id
        }
      }
    })

    await em.flush()
    await deferClearResponseCache(Player.getSearchCacheKey(game, true))

    return {
      status: 204
    }
  }
})
