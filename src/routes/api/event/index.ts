import { apiRouter } from '../../../lib/routing/router'
import { postRoute } from './post'

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
