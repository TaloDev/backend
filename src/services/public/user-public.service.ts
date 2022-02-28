import { After, Service, Request, Response, Routes, Validate } from 'koa-clay'
import User, { UserType } from '../../entities/user'
import jwt from 'jsonwebtoken'
import { promisify } from 'util'
import { EntityManager } from '@mikro-orm/core'
import UserSession from '../../entities/user-session'
import bcrypt from 'bcrypt'
import buildTokenPair from '../../lib/auth/buildTokenPair'
import setUserLastSeenAt from '../../lib/users/setUserLastSeenAt'
import getUserFromToken from '../../lib/auth/getUserFromToken'
import UserAccessCode from '../../entities/user-access-code'
import Organisation from '../../entities/organisation'
import { EmailConfig } from '../../lib/messaging/sendEmail'
import { add } from 'date-fns'
import Queue from 'bee-queue'
import confirmEmail from '../../emails/confirm-email'
import { authenticator } from '@otplib/preset-default'
import Redis from 'ioredis'
import redisConfig from '../../config/redis.config'
import UserRecoveryCode from '../../entities/user-recovery-code'
import generateRecoveryCodes from '../../lib/auth/generateRecoveryCodes'

async function sendEmailConfirm(req: Request, res: Response): Promise<void> {
  /* istanbul ignore else */
  if (res.status === 200) {
    req.ctx.state.user = jwt.decode(res.body.accessToken)
    const user: User = await getUserFromToken(req.ctx)
    const em: EntityManager = req.ctx.em

    const accessCode = new UserAccessCode(user, add(new Date(), { weeks: 1 }))
    await em.persistAndFlush(accessCode)

    await (<Queue>req.ctx.emailQueue)
      .createJob<EmailConfig>({
        to: user.email,
        subject: 'Your Talo access code',
        template: confirmEmail,
        templateData: {
          code: accessCode.code
        }
      })
      .save()
  }
}

@Routes([
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
  },
  {
    method: 'POST',
    path: '/2fa',
    handler: 'verify2fa'
  },
  {
    method: 'POST',
    path: '/2fa/recover',
    handler: 'useRecoveryCode'
  }
])
export default class UserPublicService implements Service {
  @Validate({
    body: ['email', 'password', 'organisationName']
  })
  @After(sendEmailConfirm)
  async register(req: Request): Promise<Response> {
    const { email, password, organisationName } = req.body
    const em: EntityManager = req.ctx.em

    const userWithEmail = await em.getRepository(User).findOne({ email })
    const orgWithEmail = await em.getRepository(Organisation).findOne({ email })
    if (userWithEmail || orgWithEmail) req.ctx.throw(400, 'That email address is already in use')

    const organisation = new Organisation()
    organisation.email = email
    organisation.name = organisationName

    const user = new User()
    user.email = email
    user.password = await bcrypt.hash(password, 10)
    user.organisation = organisation
    user.type = UserType.ADMIN
    user.emailConfirmed = Boolean(process.env.AUTO_CONFIRM_EMAIL)

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

  handleFailedLogin(req: Request) {
    req.ctx.throw(401, { message: 'Incorrect email address or password', showHint: true })
  }

  @Validate({
    body: ['email', 'password']
  })
  @After(setUserLastSeenAt)
  async login(req: Request): Promise<Response> {
    const { email, password } = req.body
    const em: EntityManager = req.ctx.em

    const user = await em.getRepository(User).findOne({ email })
    if (!user) this.handleFailedLogin(req)

    const passwordMatches = await bcrypt.compare(password, user.password)
    if (!passwordMatches) this.handleFailedLogin(req)

    if (user.twoFactorAuth?.enabled) {
      const redis = new Redis(redisConfig)
      await redis.set(`2fa:${user.id}`, 'true', 'ex', 300)

      return {
        status: 200,
        body: {
          twoFactorAuthRequired: true,
          userId: user.id
        }
      }
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

  @After(setUserLastSeenAt)
  async refresh(req: Request): Promise<Response> {
    const token = req.ctx.cookies.get('refreshToken')
    const userAgent = req.headers['user-agent']
    const em: EntityManager = req.ctx.em

    const session = await em.getRepository(UserSession).findOne({ token, userAgent }, { populate: ['user'] })

    if (!session) {
      req.ctx.throw(401, 'Session not found')
    }

    if (new Date() > session.validUntil) {
      await em.getRepository(UserSession).removeAndFlush(session)
      req.ctx.throw(401, 'Refresh token expired')
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
  async forgotPassword(req: Request): Promise<Response> {
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

      // todo send accessToken in email
      temp = accessToken
    } catch (err) {
      return {
        status: 204
      }
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
    body: ['password', 'token']
  })
  async changePassword(req: Request): Promise<Response> {
    const { password, token } = req.body
    const decodedToken = jwt.decode(token)

    const em: EntityManager = req.ctx.em
    const user = await em.getRepository(User).findOne(decodedToken.sub)
    const secret = user?.password.substring(0, 10)

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

  @Validate({
    body: ['code', 'userId']
  })
  @After(setUserLastSeenAt)
  async verify2fa(req: Request): Promise<Response> {
    const { code, userId } = req.body
    const em: EntityManager = req.ctx.em

    const user = await em.getRepository(User).findOne(userId)

    const redis = new Redis(redisConfig)
    const hasSession = (await redis.get(`2fa:${user.id}`)) === 'true'

    if (!hasSession) {
      req.ctx.throw(403, { message: 'Session expired', sessionExpired: true })
    }

    if (!authenticator.check(code, user.twoFactorAuth.secret)) {
      req.ctx.throw(403, 'Invalid code')
    }

    const accessToken = await buildTokenPair(req.ctx, user)
    await redis.del(`2fa:${user.id}`)

    return {
      status: 200,
      body: {
        accessToken,
        user
      }
    }
  }

  @Validate({
    body: ['code', 'userId']
  })
  async useRecoveryCode(req: Request): Promise<Response> {
    const { code, userId } = req.body
    const em: EntityManager = req.ctx.em

    const user = await em.getRepository(User).findOne(userId, { populate: ['recoveryCodes'] })

    const redis = new Redis(redisConfig)
    const hasSession = (await redis.get(`2fa:${user.id}`)) === 'true'

    if (!hasSession) {
      req.ctx.throw(403, { message: 'Session expired', sessionExpired: true })
    }

    const recoveryCode = user.recoveryCodes.getItems().find((recoveryCode) => {
      return recoveryCode.getPlainCode() === code
    })

    if (!recoveryCode) {
      req.ctx.throw(403, 'Invalid code')
    }

    em.remove(recoveryCode)

    let newRecoveryCodes: UserRecoveryCode[]
    if (user.recoveryCodes.count() === 0) {
      newRecoveryCodes = generateRecoveryCodes(user)
      user.recoveryCodes.set(newRecoveryCodes)
    }

    await em.flush()

    const accessToken = await buildTokenPair(req.ctx, user)
    await redis.del(`2fa:${user.id}`)

    return {
      status: 200,
      body: {
        user,
        accessToken,
        newRecoveryCodes
      }
    }
  }
}
