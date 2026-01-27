import { protectedRouter } from '../../../lib/routing/router'
import { listRoute } from './list'
import { listCategoriesRoute } from './list-categories'
import { createCategoryRoute } from './create-category'
import { updateCategoryRoute } from './update-category'
import { deleteCategoryRoute } from './delete-category'

export function gameFeedbackRouter() {
  return protectedRouter('/games/:gameId/game-feedback', ({ route }) => {
    route(listRoute)
    route(listCategoriesRoute)
    route(createCategoryRoute)
    route(updateCategoryRoute)
    route(deleteCategoryRoute)
  })
}
