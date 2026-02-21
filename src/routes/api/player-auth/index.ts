import { apiRouter } from '../../../lib/routing/router'
import { changeEmailRoute } from './change-email'
import { changePasswordRoute } from './change-password'
import { deleteRoute } from './delete'
import { forgotPasswordRoute } from './forgot-password'
import { loginRoute } from './login'
import { logoutRoute } from './logout'
import { registerRoute } from './register'
import { resetPasswordRoute } from './reset-password'
import { toggleVerificationRoute } from './toggle-verification'
import { verifyRoute } from './verify'

export function playerAuthAPIRouter() {
  return apiRouter(
    '/v1/players/auth',
    ({ route }) => {
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
    },
    {
      docsKey: 'PlayerAuthAPI',
    },
  )
}
