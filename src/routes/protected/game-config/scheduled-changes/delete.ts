import { EntityManager } from '@mikro-orm/mysql'
import AdminAPIKey from '../../../../entities/admin-api-key.js'
import { GameActivityType } from '../../../../entities/game-activity.js'
import Game from '../../../../entities/game.js'
import ScheduledGameConfigChange from '../../../../entities/scheduled-game-config-change.js'
import User, { UserType } from '../../../../entities/user.js'
import createGameActivity from '../../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../../lib/routing/router.js'
import { loadGame } from '../../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../../middleware/policy-middleware.js'
import { loadScheduledGameConfigChange } from './common.js'

export async function deleteScheduledGameConfigChangeHandler({
  em,
  game,
  change,
  actor,
}: {
  em: EntityManager
  game: Game
  change: ScheduledGameConfigChange
  actor: User | AdminAPIKey
}) {
  createGameActivity(em, {
    actor,
    game,
    type: GameActivityType.GAME_PROPS_SCHEDULED_CHANGE_CANCELLED,
    extra: {
      display: {
        'Scheduled prop': `${change.key}: ${change.value ?? '[deleted]'}`,
      },
    },
  })

  await em.remove(change).flush()

  return {
    status: 204,
  }
}

export const deleteScheduledChangeRoute = protectedRoute({
  method: 'delete',
  path: '/scheduled-changes/:changeId',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'cancel scheduled game config changes'),
    loadGame,
    loadScheduledGameConfigChange,
  ),
  handler: (ctx) =>
    deleteScheduledGameConfigChangeHandler({
      em: ctx.em,
      game: ctx.state.game,
      change: ctx.state.scheduledGameConfigChange,
      actor: ctx.state.user,
    }),
})
