import { RouteConfig } from '../../../lib/routing/router'
import { BaseContext } from '../../../lib/context'
import UserSession from '../../../entities/user-session'
import { genAccessToken } from '../../../lib/auth/buildTokenPair'
import { updateLastSeenAt } from './common'

export const refreshRoute: RouteConfig<BaseContext> = {
  method: 'get',
  path: '/refresh',
  handler: async (c) => {
    const token = c.req.header('cookie')?.match(/refreshToken=([^;]+)/)?.[1]
    const userAgent = c.req.header('user-agent')
    const em = c.get('em')

    const session = await em.getRepository(UserSession).findOne({
      token,
      userAgent
    }, {
      populate: ['user.organisation.games']
    })

    if (!session) {
      return c.json({ message: 'Session not found' }, 401)
    }

    if (new Date() > session.validUntil) {
      await em.removeAndFlush(session)
      return c.json({ message: 'Refresh token expired' }, 401)
    }

    const accessToken = await genAccessToken(session.user)
    await updateLastSeenAt(c, session.user)

    return c.json({
      accessToken,
      user: session.user
    })
  }
}
