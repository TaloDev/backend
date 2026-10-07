import { EntityManager } from '@mikro-orm/mysql'
import type Game from '../../../entities/game.js'
import AdminAPIKey from '../../../entities/admin-api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import Player, { DEV_BUILD_META_KEY } from '../../../entities/player.js'
import User from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { loadPlayer } from './common.js'

type ToggleDevBuildParams = {
  em: EntityManager
  game: Game
  player: Player
  actor: User | AdminAPIKey
  devBuild: boolean
}

export async function toggleDevBuildHandler({
  em,
  game,
  player,
  actor,
  devBuild,
}: ToggleDevBuildParams) {
  if (devBuild) {
    player.markAsDevBuild()
  } else {
    player.devBuild = false
    player.removeProp(DEV_BUILD_META_KEY)
  }

  createGameActivity(em, {
    actor,
    game,
    type: GameActivityType.PLAYER_DEV_BUILD_TOGGLED,
    extra: {
      playerId: player.id,
      devBuild,
      display: {
        Player: player.id,
        'Dev build': devBuild ? 'true' : 'false',
      },
    },
  })

  await em.flush()

  return {
    status: 200,
    body: {
      player,
    },
  }
}

export const toggleDevBuildRoute = protectedRoute({
  method: 'patch',
  path: '/:id/toggle-dev-build',
  schema: (z) => ({
    body: z.object({
      devBuild: z.boolean(),
    }),
  }),
  middleware: withMiddleware(loadGame, loadPlayer),
  handler: (ctx) =>
    toggleDevBuildHandler({
      em: ctx.em,
      game: ctx.state.game,
      player: ctx.state.player,
      actor: ctx.state.user,
      devBuild: ctx.state.validated.body.devBuild,
    }),
})
