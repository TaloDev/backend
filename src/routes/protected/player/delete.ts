import { EntityManager } from '@mikro-orm/mysql'
import AdminAPIKey from '../../../entities/admin-api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import Player from '../../../entities/player.js'
import User, { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { deletePlayersFromDB } from '../../../tasks/deletePlayers.js'
import { loadPlayer } from './common.js'

type DeletePlayerParams = {
  em: EntityManager
  player: Player
  actor: User | AdminAPIKey
}

export async function deletePlayerHandler({ em, player, actor }: DeletePlayerParams) {
  const game = player.game

  await deletePlayersFromDB(em, [player])

  createGameActivity(em, {
    actor,
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
}

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'delete players'),
    loadGame,
    loadPlayer,
  ),
  handler: (ctx) =>
    deletePlayerHandler({
      em: ctx.em,
      player: ctx.state.player,
      actor: ctx.state.user,
    }),
})
