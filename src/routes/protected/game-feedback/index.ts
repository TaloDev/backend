import { protectedRouter } from '../../../lib/routing/router'
import { createCategoryRoute } from './create-category'
import { deleteCategoryRoute } from './delete-category'
import { listRoute } from './list'
import { listCategoriesRoute } from './list-categories'
import { updateCategoryRoute } from './update-category'

export function gameFeedbackRouter() {
  return protectedRouter('/games/:gameId/game-feedback', ({ route }) => {
    route(listRoute)
    route(listCategoriesRoute)
    route(createCategoryRoute)
    route(updateCategoryRoute)
    route(deleteCategoryRoute)
  })
}
