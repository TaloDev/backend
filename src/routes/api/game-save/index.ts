import { apiRouter } from '../../../lib/routing/router.js'
import { deleteRoute } from './delete.js'
import { listRoute } from './list.js'
import { patchRoute } from './patch.js'
import { postRoute } from './post.js'

export function gameSaveAPIRouter() {
  return apiRouter(
    '/v1/game-saves',
    ({ route }) => {
      route(listRoute)
      route(postRoute)
      route(patchRoute)
      route(deleteRoute)
    },
    {
      docsKey: 'GameSaveAPI',
    },
  )
}
