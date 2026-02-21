import { apiRouter } from '../../../lib/routing/router'
import { deleteRoute } from './delete'
import { listRoute } from './list'
import { patchRoute } from './patch'
import { postRoute } from './post'

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
