import type Router from 'koa-tree-router'
import { apiRouter } from '../../../lib/routing/router.js'
import { changeEmailRoute } from './change-email.js'
import { changeIdentifierRoute } from './change-identifier.js'
import { changePasswordRoute } from './change-password.js'
import { deleteRoute } from './delete.js'
import { forgotPasswordRoute } from './forgot-password.js'
import { loginRoute } from './login.js'
import { logoutRoute } from './logout.js'
import { migrateRoute } from './migrate.js'
import { refreshRoute } from './refresh.js'
import { registerRoute } from './register.js'
import { resetPasswordRoute } from './reset-password.js'
import { toggleVerificationRoute } from './toggle-verification.js'
import { verifyRoute } from './verify.js'

export function playerAuthAPIRouter(router: Router) {
  apiRouter(
    '/v1/players/auth',
    ({ route }) => {
      route(registerRoute)
      route(loginRoute)
      route(refreshRoute)
      route(verifyRoute)
      route(logoutRoute)
      route(changePasswordRoute)
      route(changeEmailRoute)
      route(changeIdentifierRoute)
      route(forgotPasswordRoute)
      route(resetPasswordRoute)
      route(toggleVerificationRoute)
      route(deleteRoute)
      route(migrateRoute)
    },
    {
      router,
      docsKey: 'PlayerAuthAPI',
    },
  )
}
