import { protectedRouter } from '../../../lib/routing/router'
import { listRoute } from './list'
import { createRoute } from './create'
import { updateRoute } from './update'
import { deleteRoute } from './delete'
import { rulesRoute } from './rules'
import { previewCountRoute } from './preview-count'
import { listPinnedRoute } from './list-pinned'
import { togglePinnedRoute } from './toggle-pinned'

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
