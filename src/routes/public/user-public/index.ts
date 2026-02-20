import { publicRouter } from '../../../lib/routing/router'
import { forgotPasswordRoute } from './forgot-password'
import { loginRoute } from './login'
import { refreshRoute } from './refresh'
import { registerRoute } from './register'
import { resetPasswordRoute } from './reset-password'
import { useRecoveryCodeRoute } from './use-recovery-code'
import { verify2faRoute } from './verify-2fa'

export function userPublicRouter() {
  return publicRouter('/public/users', ({ route }) => {
    route(registerRoute)
    route(loginRoute)
    route(refreshRoute)
    route(forgotPasswordRoute)
    route(resetPasswordRoute)
    route(verify2faRoute)
    route(useRecoveryCodeRoute)
  })
}
