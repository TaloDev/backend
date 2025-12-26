import { publicRoute } from '../../../lib/routing/router'
import UserSession from '../../../entities/user-session'
import { genAccessToken } from '../../../lib/auth/buildTokenPair'
import { updateLastSeenAt } from './common'

export const refreshRoute = publicRoute({
  method: 'get',
  path: '/refresh',
  handler: async (ctx) => {
    const token = ctx.cookies.get('refreshToken')
    const userAgent = ctx.get('user-agent') || undefined
    const em = ctx.em

    const session = await em.getRepository(UserSession).findOne({
      token,
      userAgent
    }, {
      populate: ['user.organisation.games']
    })

    if (!session) {
      ctx.status = 401
      ctx.body = { message: 'Session not found' }
      return
    }

    if (new Date() > session.validUntil) {
      await em.removeAndFlush(session)
      ctx.status = 401
      ctx.body = { message: 'Refresh token expired' }
      return
    }

    const accessToken = await genAccessToken(session.user)
    await updateLastSeenAt({ em, user: session.user })

    ctx.body = {
      accessToken,
      user: session.user
    }
  }
})
