import UserSession from '../../../entities/user-session.js'
import { genAccessToken } from '../../../lib/auth/buildTokenPair.js'
import { publicRoute } from '../../../lib/routing/router.js'
import { setUserLastSeenAt } from '../../../lib/users/setUserLastSeenAt.js'

export const refreshRoute = publicRoute({
  method: 'get',
  path: '/refresh',
  handler: async (ctx) => {
    const token = ctx.cookies.get('refreshToken')
    const userAgent = ctx.get('user-agent') || undefined
    const em = ctx.em

    const session = await em.repo(UserSession).findOne(
      {
        token,
        userAgent,
      },
      {
        populate: ['user.organisation.games'],
      },
    )

    if (!session) {
      return {
        status: 401,
        body: { message: 'Session not found' },
      }
    }

    if (new Date() > session.validUntil) {
      await em.remove(session).flush()
      return {
        status: 401,
        body: { message: 'Refresh token expired' },
      }
    }

    const accessToken = await genAccessToken(session.user)
    await setUserLastSeenAt({ em, user: session.user })

    return {
      status: 200,
      body: {
        accessToken,
        user: session.user,
      },
    }
  },
})
