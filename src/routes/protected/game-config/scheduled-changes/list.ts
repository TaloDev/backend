import { EntityManager } from '@mikro-orm/mysql'
import Game from '../../../../entities/game.js'
import ScheduledGameConfigChange from '../../../../entities/scheduled-game-config-change.js'
import { protectedRoute, withMiddleware } from '../../../../lib/routing/router.js'
import { loadGame } from '../../../../middleware/game-middleware.js'

export async function listScheduledGameConfigChangesHandler({
  em,
  game,
}: {
  em: EntityManager
  game: Game
}) {
  const changes = await em
    .repo(ScheduledGameConfigChange)
    .find({ game }, { orderBy: { applyAt: 'asc' } })

  return {
    status: 200,
    body: {
      changes,
    },
  }
}

export const listScheduledChangesRoute = protectedRoute({
  method: 'get',
  path: '/scheduled-changes',
  middleware: withMiddleware(loadGame),
  handler: (ctx) =>
    listScheduledGameConfigChangesHandler({
      em: ctx.em,
      game: ctx.state.game,
    }),
})
