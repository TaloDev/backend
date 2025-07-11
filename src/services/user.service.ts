import { EntityManager } from '@mikro-orm/mysql'
import { Service, Request, Response, Route, Validate, Before } from 'koa-clay'
import UserSession from '../entities/user-session'
import buildTokenPair from '../lib/auth/buildTokenPair'
import bcrypt from 'bcrypt'
import getUserFromToken from '../lib/auth/getUserFromToken'
import UserAccessCode from '../entities/user-access-code'
import { authenticator } from '@otplib/preset-default'
import UserTwoFactorAuth from '../entities/user-two-factor-auth'
import qrcode from 'qrcode'
import generateRecoveryCodes from '../lib/auth/generateRecoveryCodes'
import User from '../entities/user'
import { randomBytes } from 'crypto'
import { TraceService } from '../lib/tracing/trace-service'

async function confirmPassword(req: Request): Promise<void> {
  const { password } = req.body

  const user = await getUserFromToken(req.ctx)

  const passwordMatches = await bcrypt.compare(password, user.password)
  if (!passwordMatches) req.ctx.throw(403, 'Incorrect password')
}

async function requires2fa(req: Request): Promise<void> {
  const user = await getUserFromToken(req.ctx)

  if (!user.twoFactorAuth?.enabled) {
    req.ctx.throw(403, 'Two factor authentication needs to be enabled')
  }

  req.ctx.state.user = user
}

@TraceService()
export default class UserService extends Service {
  @Route({
    method: 'POST',
    path: '/logout'
  })
  async logout(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const userId: number = req.ctx.state.user.sub
    const userAgent: string = req.headers['user-agent']

    const sessions = await em.getRepository(UserSession).find({ user: userId, userAgent })
    await em.removeAndFlush(sessions)
    req.ctx.cookies.set('refreshToken', null, { expires: new Date(0) })

    return {
      status: 204
    }
  }

  @Route({
    method: 'POST',
    path: '/change_password'
  })
  @Validate({
    body: ['currentPassword', 'newPassword']
  })
  async changePassword(req: Request): Promise<Response> {
    const { currentPassword, newPassword } = req.body

    const em: EntityManager = req.ctx.em
    const user = await getUserFromToken(req.ctx)

    const passwordMatches = await bcrypt.compare(currentPassword, user.password)
    if (!passwordMatches) req.ctx.throw(403, 'Current password is incorrect')

    const isSamePassword = await bcrypt.compare(newPassword, user.password)
    if (isSamePassword) req.ctx.throw(400, 'Please choose a different password')

    user.password = await bcrypt.hash(newPassword, 10)
    const userSessionRepo = em.getRepository(UserSession)
    const sessions = await userSessionRepo.find({ user })
    em.remove(sessions)

    const accessToken = await buildTokenPair(req.ctx, user)

    return {
      status: 200,
      body: {
        accessToken
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/me'
  })
  async me(req: Request): Promise<Response> {
    const user = await getUserFromToken(req.ctx)

    return {
      status: 200,
      body: {
        user
      }
    }
  }

  @Route({
    method: 'POST',
    path: '/confirm_email'
  })
  @Validate({
    body: ['code']
  })
  async confirmEmail(req: Request): Promise<Response> {
    const { code } = req.body
    const em: EntityManager = req.ctx.em

    const user = await getUserFromToken(req.ctx)
    let accessCode: UserAccessCode

    try {
      accessCode = await em.getRepository(UserAccessCode).findOneOrFail({
        user,
        code,
        validUntil: {
          $gt: new Date()
        }
      })
    } catch (err) {
      req.ctx.throw(400, 'Invalid or expired code')
    }

    user.emailConfirmed = true
    await em.removeAndFlush(accessCode)

    return {
      status: 200,
      body: {
        user
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/2fa/enable'
  })
  async enable2fa(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const user = await getUserFromToken(req.ctx)

    if (user.twoFactorAuth?.enabled) {
      req.ctx.throw(403, 'Two factor authentication is already enabled')
    }

    const secret = authenticator.generateSecret()
    const keyUri = authenticator.keyuri(user.email, 'Talo', secret)
    const qr = await qrcode.toDataURL(keyUri)

    user.twoFactorAuth = new UserTwoFactorAuth(secret)
    await em.flush()

    return {
      status: 200,
      body: {
        qr
      }
    }
  }

  @Route({
    method: 'POST',
    path: '/2fa/enable'
  })
  @Validate({
    body: ['code']
  })
  async confirm2fa(req: Request): Promise<Response> {
    const { code } = req.body
    const em: EntityManager = req.ctx.em

    const user = await getUserFromToken(req.ctx)
    const twoFactorAuth = user.twoFactorAuth

    if (twoFactorAuth?.enabled) {
      req.ctx.throw(403, 'Two factor authentication is already enabled')
    }

    const secret = twoFactorAuth?.secret ?? randomBytes(16).toString('hex') // random secret so it always fails
    if (!authenticator.check(code, secret)) {
      req.ctx.throw(403, 'Invalid code')
    }

    user.recoveryCodes.set(generateRecoveryCodes(user))
    twoFactorAuth!.enabled = true
    await em.flush()

    return {
      status: 200,
      body: {
        user,
        recoveryCodes: user.recoveryCodes
      }
    }
  }

  @Route({
    method: 'POST',
    path: '/2fa/disable'
  })
  @Before(confirmPassword)
  @Before(requires2fa)
  async disable2fa(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const user: User = req.ctx.state.user

    await user.recoveryCodes.init()
    await em.removeAndFlush([user.twoFactorAuth, ...user.recoveryCodes])

    return {
      status: 200,
      body: {
        user
      }
    }
  }

  @Route({
    method: 'POST',
    path: '/2fa/recovery_codes/create'
  })
  @Before(confirmPassword)
  @Before(requires2fa)
  async createRecoveryCodes(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const user: User = req.ctx.state.user
    await user.recoveryCodes.init()
    user.recoveryCodes.set(generateRecoveryCodes(user))

    await em.flush()

    return {
      status: 200,
      body: {
        recoveryCodes: user.recoveryCodes
      }
    }
  }

  @Route({
    method: 'POST',
    path: '/2fa/recovery_codes/view'
  })
  @Before(confirmPassword)
  @Before(requires2fa)
  async viewRecoveryCodes(req: Request): Promise<Response> {
    const user: User = req.ctx.state.user
    const recoveryCodes = await user.recoveryCodes.loadItems()

    return {
      status: 200,
      body: {
        recoveryCodes
      }
    }
  }
}
