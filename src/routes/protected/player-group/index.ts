import { protectedRouter } from '../../../lib/routing/router'
import { createRoute } from './create'
import { deleteRoute } from './delete'
import { listRoute } from './list'
import { listPinnedRoute } from './list-pinned'
import { previewCountRoute } from './preview-count'
import { rulesRoute } from './rules'
import { togglePinnedRoute } from './toggle-pinned'
import { updateRoute } from './update'

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
