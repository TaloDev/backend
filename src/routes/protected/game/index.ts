import { protectedRouter } from '../../../lib/routing/router.js'
import { createRoute } from './create.js'
import { settingsRoute } from './settings.js'
import { updateRoute } from './update.js'

export function gameRouter() {
  return protectedRouter('/games', ({ route }) => {
    route(settingsRoute)
    route(createRoute)
    route(updateRoute)
  })
}
