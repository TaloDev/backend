import type Koa from 'koa'
import type { EntityManager } from '@mikro-orm/mysql'
import User from '../../../entities/user'
import UserSession from '../../../entities/user-session'
import { genAccessToken } from '../../../lib/auth/buildTokenPair'
import { setUser } from '@sentry/node'
import { differenceInDays } from 'date-fns'

export async function buildTokenPair({ em, ctx, user, userAgent }: {
  em: EntityManager
  ctx: Pick<Koa.Context, 'set'>
  user: User
  userAgent?: string
}) {
  const existingSessions = await em.repo(UserSession).find({ user, userAgent })
  em.remove(existingSessions)

  const session = new UserSession(user)
  session.userAgent = userAgent
  await em.persist(session).flush()

  ctx.set('Set-Cookie', `refreshToken=${session.token}; Path=/; HttpOnly; SameSite=Strict; Expires=${session.validUntil.toUTCString()}`)
  setUser({ id: String(user.id), username: user.username })

  return genAccessToken(user)
}

export async function updateLastSeenAt({ em, user }: {
  em: EntityManager
  user: User
}) {
  if (differenceInDays(new Date(), user.lastSeenAt) >= 1) {
    user.lastSeenAt = new Date()
    await em.flush()
  }
}
