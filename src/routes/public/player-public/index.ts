import { publicRouter } from '../../../lib/routing/router'
import { deleteRoute } from './delete'
import { gameRoute } from './game'
import { loginRoute } from './login'
import { verifyRoute } from './verify'

export function playerPublicRouter() {
  return publicRouter('/public/players/:token', ({ route }) => {
    route(gameRoute)
    route(loginRoute)
    route(verifyRoute)
    route(deleteRoute)
  })
}
