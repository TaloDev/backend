import { protectedRouter } from '../../../lib/routing/router.js'
import { createRoute } from './create.js'
import { deleteRoute } from './delete.js'
import { listPinnedRoute } from './list-pinned.js'
import { listRoute } from './list.js'
import { previewCountRoute } from './preview-count.js'
import { rulesRoute } from './rules.js'
import { togglePinnedRoute } from './toggle-pinned.js'
import { updateRoute } from './update.js'

export function playerGroupRouter() {
  return protectedRouter('/games/:gameId/player-groups', ({ route }) => {
    route(listRoute)
    route(createRoute)
    route(updateRoute)
    route(deleteRoute)
    route(rulesRoute)
    route(previewCountRoute)
    route(listPinnedRoute)
    route(togglePinnedRoute)
  })
}
