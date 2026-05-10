import { publicRouter } from '../../../lib/routing/router.js'
import { forgotPasswordRoute } from './forgot-password.js'
import { loginRoute } from './login.js'
import { refreshRoute } from './refresh.js'
import { registerRoute } from './register.js'
import { resetPasswordRoute } from './reset-password.js'
import { useRecoveryCodeRoute } from './use-recovery-code.js'
import { verify2faRoute } from './verify-2fa.js'

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
