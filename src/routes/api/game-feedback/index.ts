import { apiRouter } from '../../../lib/routing/router'
import { listCategoriesRoute } from './list-categories'
import { postRoute } from './post'

export function gameFeedbackAPIRouter() {
  return apiRouter('/v1/game-feedback', ({ route }) => {
    route(listCategoriesRoute)
    route(postRoute)
  }, {
    docsKey: 'GameFeedbackAPI'
  })
}
