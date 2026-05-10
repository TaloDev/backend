import { publicRouter } from '../../../lib/routing/router.js'
import { deleteRoute } from './delete.js'
import { gameRoute } from './game.js'
import { loginRoute } from './login.js'
import { verifyRoute } from './verify.js'

export function playerPublicRouter() {
  return publicRouter('/public/players/:token', ({ route }) => {
    route(gameRoute)
    route(loginRoute)
    route(verifyRoute)
    route(deleteRoute)
  })
}
