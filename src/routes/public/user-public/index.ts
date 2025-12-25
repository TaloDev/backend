import { BaseContext } from '../../../lib/context'
import { registerRoute } from './register'
import { loginRoute } from './login'
import { refreshRoute } from './refresh'
import { forgotPasswordRoute } from './forgot-password'
import { resetPasswordRoute } from './reset-password'
import { verify2faRoute } from './verify-2fa'
import { useRecoveryCodeRoute } from './use-recovery-code'
import { publicRouter } from '../../../lib/routing/router'

export function userPublicRoutes() {
  return publicRouter<BaseContext>('UserPublic', '/users', ({ route }) => {
    route(registerRoute)
    route(loginRoute)
    route(refreshRoute)
    route(forgotPasswordRoute)
    route(resetPasswordRoute)
    route(verify2faRoute)
    route(useRecoveryCodeRoute)
  })
}
