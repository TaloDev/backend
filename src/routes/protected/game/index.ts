import { protectedRouter } from '../../../lib/routing/router'
import { createRoute } from './create'
import { settingsRoute } from './settings'
import { updateRoute } from './update'

export function gameRouter() {
  return protectedRouter('/games', ({ route }) => {
    route(settingsRoute)
    route(createRoute)
    route(updateRoute)
  })
}
