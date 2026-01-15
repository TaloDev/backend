import { protectedRouter } from '../../../lib/routing/router'
import { settingsRoute } from './settings'
import { createRoute } from './create'
import { updateRoute } from './update'

export function gameRouter() {
  return protectedRouter('/games', ({ route }) => {
    route(settingsRoute)
    route(createRoute)
    route(updateRoute)
  })
}
