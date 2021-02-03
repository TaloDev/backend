import { After, HookParams, Resource, Service, ServiceRequest, ServiceResponse, ServiceRoute, Validate } from 'koa-rest-services'
import User from '../../entities/user'
import jwt from 'jsonwebtoken'
import { promisify } from 'util'
import { EntityManager } from '@mikro-orm/core'
import UserSession from '../../entities/user-session'
import bcrypt from 'bcrypt'
import buildTokenPair from '../../lib/auth/buildTokenPair'
import setUserLastSeenAt from '../../lib/users/setUserLastSeenAt'
import getUserFromToken from '../../lib/auth/getUserFromToken'
import UserAccessCode from '../../entities/user-access-code'
import UserResource from '../../resources/user.resource'

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
    method: 'GET',
    path: '/refresh',
    handler: 'refresh'
  },
  {
    method: 'POST',
    path: '/forgot_password',
    handler: 'forgotPassword'
  },
  {
    method: 'POST',
    path: '/change_password',
    handler: 'changePassword'
  }
]

export default class UsersPublicService implements Service {
  @Validate({
    body: ['email', 'password']
  })
  @Resource(UserResource, 'user')
  @After('sendEmailConfirm')
  async register(req: ServiceRequest): Promise<ServiceResponse> {
    const { email, password } = req.body
    const em: EntityManager = req.ctx.em

    const userWithEmail = await em.getRepository(User).findOne({ email })
    if (userWithEmail) {
      req.ctx.throw(400, 'That email address is already in use')
    }

    const user = new User()
    user.email = email
    user.password = await bcrypt.hash(password, 10)
    await em.getRepository(User).persistAndFlush(user)

    const accessToken = await buildTokenPair(req.ctx, user)

    return {
      status: 200,
      body: {
        accessToken,
        user
      }
    }
  }

  async sendEmailConfirm(hook: HookParams): Promise<void> {
    if (hook.result.status === 200) {
      hook.req.ctx.state.user = jwt.decode(hook.result.body.accessToken)
      const user: User = await getUserFromToken(hook.req.ctx)
      const em: EntityManager = hook.req.ctx.em

      const accesscode = new UserAccessCode(user)
      await em.persistAndFlush(accesscode)
    }
  }

  @Validate({
    body: ['email', 'password']
  })
  @Resource(UserResource, 'user')
  @After(setUserLastSeenAt)
  async login(req: ServiceRequest): Promise<ServiceResponse> {
    const { email, password } = req.body
    const em: EntityManager = req.ctx.em

    const user = await em.getRepository(User).findOne({ email })
    const passwordMatches = await bcrypt.compare(password, user?.password ?? '')

    if (!user || !passwordMatches) {
      req.ctx.throw(401, 'Incorrect email address or password', { showHint: true })
    }

    const accessToken = await buildTokenPair(req.ctx, user)

    return {
      status: 200,
      body: {
        accessToken,
        user
      }
    }
  }

  @Resource(UserResource, 'user')
  @After(setUserLastSeenAt)
  async refresh(req: ServiceRequest): Promise<ServiceResponse> {
    const token = req.ctx.cookies.get('refreshToken')
    const userAgent = req.headers['user-agent']
    const em: EntityManager = req.ctx.em

    let session = await em.getRepository(UserSession).findOne({ token, userAgent }, ['user'])
    if (!session) {
      req.ctx.throw(401, 'Session not found')
    }

    if (new Date() > session.validUntil) {
      await em.getRepository(UserSession).removeAndFlush(session)
      req.ctx.throw(403, 'Refresh token expired')
    }

    const accessToken = await buildTokenPair(req.ctx, session.user)

    return {
      status: 200,
      body: {
        accessToken,
        user: session.user
      }
    }
  }

  @Validate({
    body: ['email']
  })
  @Resource(UserResource, 'user')
  async forgotPassword(req: ServiceRequest): Promise<ServiceResponse> {
    const { email } = req.body
    const em: EntityManager = req.ctx.em

    let temp = null
    let user: User

    try {
      user = await em.getRepository(User).findOneOrFail({ email })
      const secret = user.password.substring(0, 10)
      const payload = { sub: user.id }
      const sign = promisify(jwt.sign)
      const accessToken = await sign(payload, secret, { expiresIn: '15m' })

      // TODO send accessToken in email
      temp = accessToken
    } catch (err) {
      console.warn(`User with email ${email} not found for password reset`)
    }

    return {
      status: 200,
      body: {
        accessToken: temp,
        user
      }
    }
  }

  @Validate({
    body: {
      password: 'Missing body parameter: password',
      token: 'Missing body parameter: token'
    }
  })
  @Resource(UserResource, 'user')
  async changePassword(req: ServiceRequest): Promise<ServiceResponse> {
    const { password, token } = req.body
    const decodedToken = jwt.decode(token)
    
    const em: EntityManager = req.ctx.em
    const user = await em.getRepository(User).findOne(decodedToken.sub)
    const secret = user.password.substring(0, 10)

    try {
      await promisify(jwt.verify)(token, secret)
    } catch (err) {
      req.ctx.throw(401, 'Request expired')
    }

    const isSamePassword = await bcrypt.compare(password, user.password)
    if (isSamePassword) {
      req.ctx.throw(400, 'Please choose a different password')
    }

    user.password = await bcrypt.hash(password, 10)
    const userSessionRepo = em.getRepository(UserSession)
    const sessions = await userSessionRepo.find({ user })
    await userSessionRepo.remove(sessions)

    const accessToken = await buildTokenPair(req.ctx, user)

    return {
      status: 200,
      body: {
        accessToken,
        user
      }
    }
  }
}
