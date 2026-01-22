import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import GameFeedbackCategory from '../../../entities/game-feedback-category'
import { EntityManager } from '@mikro-orm/mysql'
import Game from '../../../entities/game'

export const listCategoriesRoute = protectedRoute({
  method: 'get',
  path: '/categories',
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    return await listCategoriesHandler({ em: ctx.em, game: ctx.state.game })
  }
})

export async function listCategoriesHandler({
  em,
  game
}: {
  em: EntityManager
  game: Game
}) {
  const feedbackCategories = await em.repo(GameFeedbackCategory).find({ game })

  return {
    status: 200,
    body: {
      feedbackCategories
    }
  }
}
