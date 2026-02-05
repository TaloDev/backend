import { apiRouter } from '../../../lib/routing/router'
import { registerRoute } from './register'
import { loginRoute } from './login'
import { verifyRoute } from './verify'
import { logoutRoute } from './logout'
import { changePasswordRoute } from './change-password'
import { changeEmailRoute } from './change-email'
import { forgotPasswordRoute } from './forgot-password'
import { resetPasswordRoute } from './reset-password'
import { toggleVerificationRoute } from './toggle-verification'
import { deleteRoute } from './delete'

export function playerAuthAPIRouter() {
  return apiRouter('/v1/players/auth', ({ route }) => {
    route(registerRoute)
    route(loginRoute)
    route(verifyRoute)
    route(logoutRoute)
    route(changePasswordRoute)
    route(changeEmailRoute)
    route(forgotPasswordRoute)
    route(resetPasswordRoute)
    route(toggleVerificationRoute)
    route(deleteRoute)
  }, {
    docsKey: 'PlayerAuthAPI'
  })
}
