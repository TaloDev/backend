import { protectedRouter } from '../../../lib/routing/router'
import { confirm2faRoute } from './2fa-confirm'
import { disable2faRoute } from './2fa-disable'
import { enable2faRoute } from './2fa-enable'
import { createRecoveryCodesRoute } from './2fa-recovery-codes-create'
import { viewRecoveryCodesRoute } from './2fa-recovery-codes-view'
import { changePasswordRoute } from './change-password'
import { confirmEmailRoute } from './confirm-email'
import { logoutRoute } from './logout'
import { meRoute } from './me'

export function userRouter() {
  return protectedRouter('/users', ({ route }) => {
    route(meRoute)
    route(logoutRoute)
    route(changePasswordRoute)
    route(confirmEmailRoute)
    route(enable2faRoute)
    route(confirm2faRoute)
    route(disable2faRoute)
    route(createRecoveryCodesRoute)
    route(viewRecoveryCodesRoute)
  })
}
