import { apiRouter } from '../../../lib/routing/router.js'
import { postRoute } from './post.js'

export function eventAPIRouter() {
  return apiRouter(
    '/v1/events',
    ({ route }) => {
      route(postRoute)
    },
    {
      docsKey: 'EventAPI',
    },
  )
}
