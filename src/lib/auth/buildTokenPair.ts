import { EntityManager } from '@mikro-orm/mysql'
import { Context } from 'koa'
import { sign } from './jwt'
import User from '../../entities/user'
import UserSession from '../../entities/user-session'
import { setUser } from '@sentry/node'

export async function genAccessToken(user: User): Promise<string> {
  const payload = { sub: user.id }
  const accessToken = await sign(payload, process.env.JWT_SECRET!, { expiresIn: '5m' })
  return accessToken
}

async function createSession(ctx: Context, user: User): Promise<UserSession> {
  const userAgent = ctx.headers['user-agent']
  const em: EntityManager = ctx.em

  const existingSessions = await em.getRepository(UserSession).find({ user, userAgent })
  await em.removeAndFlush(existingSessions)

  const session = new UserSession(user)
  session.userAgent = userAgent
  await em.persistAndFlush(session)
  return session
}

const setRefreshToken = (ctx: Context, session: UserSession): void => {
  const refreshToken = session.token
  ctx.cookies.set('refreshToken', refreshToken, {
    secure: ctx.request.secure,
    expires: session.validUntil,
    sameSite: 'strict'
  })
}

const buildTokenPair = async (ctx: Context, user: User): Promise<string> => {
  const accessToken = await genAccessToken(user)
  const session = await createSession(ctx, user)
  setRefreshToken(ctx, session)

  setUser({ id: String(user.id), username: user.username })

  return accessToken
}

export default buildTokenPair
