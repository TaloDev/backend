import { After, Service, Request, Response, Routes, Validate } from 'koa-clay'
import User, { UserType } from '../../entities/user'
import jwt from 'jsonwebtoken'
import { promisify } from 'util'
import { EntityManager } from '@mikro-orm/mysql'
import UserSession from '../../entities/user-session'
import bcrypt from 'bcrypt'
import buildTokenPair from '../../lib/auth/buildTokenPair'
import setUserLastSeenAt from '../../lib/users/setUserLastSeenAt'
import UserAccessCode from '../../entities/user-access-code'
import Organisation from '../../entities/organisation'
import { add } from 'date-fns'
import { authenticator } from '@otplib/preset-default'
import { createRedisConnection } from '../../config/redis.config'
import UserRecoveryCode from '../../entities/user-recovery-code'
import generateRecoveryCodes from '../../lib/auth/generateRecoveryCodes'
import Invite from '../../entities/invite'
import ConfirmEmail from '../../emails/confirm-email-mail'
import { GameActivityType } from '../../entities/game-activity'
import createGameActivity from '../../lib/logging/createGameActivity'
import createDefaultPricingPlan from '../../lib/billing/createDefaultPricingPlan'
import handlePricingPlanAction from '../../lib/billing/handlePricingPlanAction'
import { PricingPlanActionType } from '../../entities/pricing-plan-action'
import queueEmail from '../../lib/messaging/queueEmail'
import ResetPassword from '../../emails/reset-password'

async function sendEmailConfirm(req: Request, res: Response): Promise<void> {
  const user: User = req.ctx.state.user

  /* v8 ignore start */
  if (res.status === 200 && !user.emailConfirmed) {
    const em: EntityManager = req.ctx.em

    const accessCode = new UserAccessCode(user, add(new Date(), { weeks: 1 }))
    await em.persistAndFlush(accessCode)

    await queueEmail(req.ctx.emailQueue, new ConfirmEmail(user, accessCode.code))
  }
  /* v8 ignore stop */
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
    path: '/reset_password',
    handler: 'resetPassword'
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
export default class UserPublicService extends Service {
  @Validate({
    body: {
      email: {
        required: true
      },
      username: {
        required: true
      },
      password: {
        required: true
      },
      organisationName: {
        requiredIf: async (req: Request) => !req.body.inviteToken
      },
      inviteToken: {
        requiredIf: async (req: Request) => !req.body.organisationName
      }
    }
  })
  @After(sendEmailConfirm)
  async register(req: Request): Promise<Response> {
    const { email, username, password, organisationName, inviteToken } = req.body
    const em: EntityManager = req.ctx.em

    const userWithEmail = await em.getRepository(User).findOne({ email })
    const orgWithEmail = await em.getRepository(Organisation).findOne({ email })
    if (userWithEmail || orgWithEmail) req.ctx.throw(400, 'That email address is already in use')

    const user = new User()
    user.email = email.toLowerCase()
    user.username = username
    user.password = await bcrypt.hash(password, 10)
    user.emailConfirmed = process.env.AUTO_CONFIRM_EMAIL === 'true'

    if (inviteToken) {
      const invite = await em.getRepository(Invite).findOne({ token: inviteToken })
      if (!invite || invite.email !== email) req.ctx.throw(404, 'Invite not found')

      user.organisation = invite.organisation
      user.type = invite.type
      user.emailConfirmed = true

      createGameActivity(em, { user, type: GameActivityType.INVITE_ACCEPTED })

      await em.remove(invite)
    } else {
      const organisation = new Organisation()
      organisation.email = email
      organisation.name = organisationName
      organisation.pricingPlan = await createDefaultPricingPlan(em, organisation)

      user.organisation = organisation
      user.type = UserType.OWNER
    }

    req.ctx.state.user = user
    await em.persistAndFlush(user)
    await em.populate(user, ['organisation'])

    if (!inviteToken) {
      await handlePricingPlanAction(req, PricingPlanActionType.USER_INVITE, { initialUser: true, invitedUserEmail: user.email })
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

  private handleFailedLogin(req: Request) {
    req.ctx.throw(401, 'Incorrect email address or password')
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
      const redis = createRedisConnection(req.ctx)
      await redis.set(`2fa:${user.id}`, 'true', 'EX', 300)

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
      await em.removeAndFlush(session)
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

    const user = await em.getRepository(User).findOne({ email })

    if (user) {
      const secret = user.password.substring(0, 10)
      const payload = { sub: user.id }
      const sign = promisify(jwt.sign)
      const accessToken = await sign(payload, secret, { expiresIn: '15m' })
      await queueEmail(req.ctx.emailQueue, new ResetPassword(user, accessToken))
    }

    return {
      status: 204
    }
  }

  @Validate({
    body: ['password', 'token']
  })
  async resetPassword(req: Request): Promise<Response> {
    const { password, token } = req.body
    const decodedToken = jwt.decode(token)

    const em: EntityManager = req.ctx.em
    const user = await em.getRepository(User).findOne(decodedToken.sub)
    const secret = user?.password.substring(0, 10)

    try {
      await promisify(jwt.verify)(token, secret)
    } catch (err) {
      req.ctx.throw(401, { message: 'Request expired', expired: true })
    }

    const isSamePassword = await bcrypt.compare(password, user.password)
    if (isSamePassword) {
      req.ctx.throw(400, 'Please choose a different password')
    }

    user.password = await bcrypt.hash(password, 10)

    const sessions = await em.repo(UserSession).find({ user })
    await em.removeAndFlush(sessions)

    return {
      status: 204
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

    const redis = createRedisConnection(req.ctx)
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
    body: ['userId', 'code']
  })
  async useRecoveryCode(req: Request): Promise<Response> {
    const { code, userId } = req.body
    const em: EntityManager = req.ctx.em

    const user = await em.getRepository(User).findOne(userId, { populate: ['recoveryCodes'] })

    const redis = createRedisConnection(req.ctx)
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
