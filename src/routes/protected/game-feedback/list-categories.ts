import { EntityManager } from '@mikro-orm/mysql'
import GameFeedbackCategory from '../../../entities/game-feedback-category.js'
import Game from '../../../entities/game.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'

export async function listCategoriesHandler({ em, game }: { em: EntityManager; game: Game }) {
  const feedbackCategories = await em.repo(GameFeedbackCategory).find({ game })

  return {
    status: 200,
    body: {
      feedbackCategories,
    },
  }
}

export const listCategoriesRoute = protectedRoute({
  method: 'get',
  path: '/categories',
  middleware: withMiddleware(loadGame),
  handler: (ctx) => {
    return listCategoriesHandler({ em: ctx.em, game: ctx.state.game })
  },
})
