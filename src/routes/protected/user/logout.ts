import UserSession from '../../../entities/user-session.js'
import { protectedRoute } from '../../../lib/routing/router.js'
import { clearRefreshTokenCookie } from './common.js'

export const logoutRoute = protectedRoute({
  method: 'post',
  path: '/logout',
  handler: async (ctx) => {
    const em = ctx.em
    const userAgent = ctx.get('user-agent')

    const sessions = await em.repo(UserSession).find({
      user: ctx.state.jwt.sub,
      userAgent,
    })
    await em.remove(sessions).flush()

    clearRefreshTokenCookie(ctx)

    return {
      status: 204,
    }
  },
})
