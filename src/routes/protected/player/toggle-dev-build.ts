import { GameActivityType } from '../../../entities/game-activity.js'
import { DEV_BUILD_META_KEY } from '../../../entities/player.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { loadPlayer } from './common.js'

export const toggleDevBuildRoute = protectedRoute({
  method: 'patch',
  path: '/:id/toggle-dev-build',
  schema: (z) => ({
    body: z.object({
      devBuild: z.boolean(),
    }),
  }),
  middleware: withMiddleware(loadGame, loadPlayer),
  handler: async (ctx) => {
    const em = ctx.em
    const player = ctx.state.player
    const { devBuild } = ctx.state.validated.body

    if (devBuild) {
      player.markAsDevBuild()
    } else {
      player.devBuild = false
      player.removeProp(DEV_BUILD_META_KEY)
    }

    createGameActivity(em, {
      user: ctx.state.user,
      game: ctx.state.game,
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
  },
})
