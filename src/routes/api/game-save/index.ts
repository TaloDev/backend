import { apiRouter } from '../../../lib/routing/router'
import { listRoute } from './list'
import { postRoute } from './post'
import { patchRoute } from './patch'
import { deleteRoute } from './delete'

export function gameSaveAPIRouter() {
  return apiRouter('/v1/game-saves', ({ route }) => {
    route(listRoute)
    route(postRoute)
    route(patchRoute)
    route(deleteRoute)
  }, {
    docsKey: 'GameSaveAPI'
  })
}
