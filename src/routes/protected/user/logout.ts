import { protectedRoute } from '../../../lib/routing/router'
import UserSession from '../../../entities/user-session'

export const logoutRoute = protectedRoute({
  method: 'post',
  path: '/logout',
  handler: async (ctx) => {
    const em = ctx.em
    const userAgent = ctx.get('user-agent')

    const sessions = await em.repo(UserSession).find({
      user: ctx.state.jwt.sub,
      userAgent
    })
    await em.remove(sessions).flush()

    ctx.cookies.set('refreshToken', null, { expires: new Date(0) })

    return {
      status: 204
    }
  }
})
