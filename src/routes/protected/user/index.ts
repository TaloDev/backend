import type Router from 'koa-tree-router'
import { protectedRouter } from '../../../lib/routing/router.js'
import { confirm2faRoute } from './2fa-confirm.js'
import { disable2faRoute } from './2fa-disable.js'
import { enable2faRoute } from './2fa-enable.js'
import { createRecoveryCodesRoute } from './2fa-recovery-codes-create.js'
import { viewRecoveryCodesRoute } from './2fa-recovery-codes-view.js'
import { changePasswordRoute } from './change-password.js'
import { confirmEmailRoute } from './confirm-email.js'
import { logoutRoute } from './logout.js'
import { meRoute } from './me.js'

export function userRouter(router: Router) {
  protectedRouter(
    '/users',
    ({ route }) => {
      route(meRoute)
      route(logoutRoute)
      route(changePasswordRoute)
      route(confirmEmailRoute)
      route(enable2faRoute)
      route(confirm2faRoute)
      route(disable2faRoute)
      route(createRecoveryCodesRoute)
      route(viewRecoveryCodesRoute)
    },
    { router },
  )
}
