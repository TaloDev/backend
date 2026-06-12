import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { createCategoryRoute } from './create-category.js'
import { deleteCategoryRoute } from './delete-category.js'
import { listCategoriesRoute } from './list-categories.js'
import { listRoute } from './list.js'
import { resetCategoryRoute } from './reset-category.js'
import { toggleArchivedRoute } from './toggle-archived.js'
import { updateCategoryRoute } from './update-category.js'

export function gameFeedbackRouter(router: Router) {
  protectedRouter(
    '/games/:gameId/game-feedback',
    ({ route }) => {
      route(listRoute)
      route(listCategoriesRoute)
      route(createCategoryRoute)
      route(updateCategoryRoute)
      route(deleteCategoryRoute)
      route(toggleArchivedRoute)
      route(resetCategoryRoute)
    },
    { router },
  )
}
