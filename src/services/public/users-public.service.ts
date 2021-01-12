import { Service, ServiceRequest, ServiceResponse, ServiceRoute, Validate } from 'koa-rest-services'
import User from '../../entities/user'
import jwt from 'jsonwebtoken'
import { promisify } from 'util'
import { EntityManager } from '@mikro-orm/core'
import UserSession from '../../entities/user-session'
import { Context } from 'koa'
import bcrypt from 'bcrypt'

export const usersPublicRoutes: ServiceRoute[] = [
  {
    method: 'POST',
    path: '/register',
    handler: 'register'
  },
  {
    method: 'POST',
    path: '/login',
    handler: 'login'
  },
  {
    method: 'POST',
    path: '/logout',
    handler: 'logout'
  },
  {
    method: 'POST',
    path: '/refresh',
    handler: 'refresh'
  }
]

export default class UsersPublicService implements Service {
  async genAccessToken(user: User): Promise<string[]> {
    const payload = { sub: user.id }
    const sign = promisify(jwt.sign)
    const accessToken = await sign(payload, process.env.JWT_SECRET, { expiresIn: '5m' })
    return accessToken
  }

  async createSession(user: User, em: EntityManager): Promise<UserSession> {
    const existingSession = await em.getRepository(UserSession).findOne({ user })
    if (existingSession) {
      await em.removeAndFlush(existingSession)
    }

    const session = new UserSession(user)
    await em.persistAndFlush(session)
    return session
  }

  setRefreshToken(session: UserSession, ctx: Context): void {
    const refreshToken = session.token
    ctx.cookies.set('refreshToken', refreshToken, {
      secure: ctx.request.secure,
      expires: session.validUntil
    })
  }

  @Validate({
    body: {
      email: 'Missing body parameter: email',
      password: 'Missing body parameter: password'
    }
  })
  async register(req: ServiceRequest): Promise<ServiceResponse> {
    const { email, password } = req.body
    const em: EntityManager = req.ctx.em

    const user = new User()
    user.email = email
    user.password = await bcrypt.hash(password, 10)
    await em.getRepository(User).persistAndFlush(user)

    const accessToken = await this.genAccessToken(user)
    const session = await this.createSession(user, em)
    this.setRefreshToken(session, req.ctx)

    return {
      status: 200,
      body: {
        accessToken
      }
    }
  }

  @Validate({
    body: {
      email: 'Missing body parameter: email',
      password: 'Missing body parameter: password'
    }
  })
  async login(req: ServiceRequest): Promise<ServiceResponse> {
    const { email, password } = req.body
    const em: EntityManager = req.ctx.em

    const user = await em.getRepository(User).findOne({ email })
    const passwordMatches = await bcrypt.compare(password, user?.password)

    if (!user || !passwordMatches) {
      req.ctx.throw(401, 'Email address or password incorrect')
    }

    const accessToken = await this.genAccessToken(user)
    const session = await this.createSession(user, em)
    this.setRefreshToken(session, req.ctx)

    return {
      status: 200,
      body: {
        accessToken
      }
    }
  }

  async refresh(req: ServiceRequest): Promise<ServiceResponse> {
    const token = req.ctx.cookies.get('refreshToken')
    const em: EntityManager = req.ctx.em

    let session = await em.getRepository(UserSession).findOne({ token })
    if (!session) {
      req.ctx.throw(401, 'Session not found')
    }

    if (new Date() > session.validUntil) {
      await em.getRepository(UserSession).removeAndFlush(session)
      req.ctx.throw(403, 'Refresh token expired')
    }

    const accessToken = await this.genAccessToken(session.user)
    session = await this.createSession(session.user, em)
    this.setRefreshToken(session, req.ctx)

    return {
      status: 200,
      body: {
        accessToken
      }
    }
  }
}
