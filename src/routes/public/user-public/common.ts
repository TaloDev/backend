import { Context } from 'hono'
import User from '../../../entities/user'
import UserSession from '../../../entities/user-session'
import { genAccessToken } from '../../../lib/auth/buildTokenPair'
import { setUser } from '@sentry/node'
import { differenceInDays } from 'date-fns'

/**
 * Create session and set refresh token cookie (Hono version of buildTokenPair)
 */
export async function buildTokenPair(c: Context, user: User): Promise<string> {
  const em = c.get('em')
  const userAgent = c.req.header('user-agent')

  // Remove existing sessions for this user agent
  const existingSessions = await em.getRepository(UserSession).find({ user, userAgent })
  em.remove(existingSessions)

  // Create new session
  const session = new UserSession(user)
  session.userAgent = userAgent
  await em.persistAndFlush(session)

  // Set refresh token cookie
  c.header('Set-Cookie', `refreshToken=${session.token}; Path=/; HttpOnly; SameSite=Strict; Expires=${session.validUntil.toUTCString()}`)

  // Set Sentry user
  setUser({ id: String(user.id), username: user.username })

  // Return access token
  return await genAccessToken(user)
}

/**
 * Update user's last seen timestamp if more than 1 day has passed
 */
export async function updateLastSeenAt(c: Context, user: User): Promise<void> {
  const em = c.get('em')

  if (differenceInDays(new Date(), user.lastSeenAt) >= 1) {
    user.lastSeenAt = new Date()
    await em.flush()
  }
}
