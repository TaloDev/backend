import type { EntityManager } from '@mikro-orm/mysql'
import type Koa from 'koa'
import User from '../../entities/user'
import UserSession from '../../entities/user-session'
import { sign } from './jwt'

export async function genAccessToken(user: User) {
  const payload = { sub: user.id }
  const accessToken = await sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' })
  return accessToken
}

async function createSession(em: EntityManager, user: User, userAgent?: string) {
  const existingSessions = await em.repo(UserSession).find({ user, userAgent })
  em.remove(existingSessions)

  const session = new UserSession(user)
  session.userAgent = userAgent
  await em.persist(session).flush()
  return session
}

const setRefreshToken = (ctx: Pick<Koa.Context, 'cookies' | 'request'>, session: UserSession) => {
  const refreshToken = session.token
  ctx.cookies.set('refreshToken', refreshToken, {
    secure: ctx.request.secure,
    expires: session.validUntil,
    sameSite: 'strict',
  })
}

export async function buildTokenPair({
  em,
  ctx,
  user,
  userAgent,
}: {
  em: EntityManager
  ctx: Pick<Koa.Context, 'cookies' | 'request'>
  user: User
  userAgent?: string
}) {
  const accessToken = await genAccessToken(user)
  const session = await createSession(em, user, userAgent)
  setRefreshToken(ctx, session)

  return accessToken
}
