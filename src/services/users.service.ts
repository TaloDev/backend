import { EntityManager } from '@mikro-orm/core'
import { Service, ServiceRequest, ServiceResponse, Routes, Validate } from 'koa-rest-services'
import UserSession from '../entities/user-session'
import buildTokenPair from '../lib/auth/buildTokenPair'
import bcrypt from 'bcrypt'
import getUserFromToken from '../lib/auth/getUserFromToken'
import UserAccessCode from '../entities/user-access-code'
import { authenticator } from '@otplib/preset-default'
import UserTwoFactorAuth from '../entities/user-two-factor-auth'
import qrcode from 'qrcode'

@Routes([
  {
    method: 'POST',
    path: '/logout',
    handler: 'logout'
  },
  {
    method: 'POST',
    path: '/change_password',
    handler: 'changePassword'
  },
  {
    method: 'GET',
    path: '/me',
    handler: 'me'
  },
  {
    method: 'POST',
    path: '/confirm_email',
    handler: 'confirmEmail'
  },
  {
    method: 'GET',
    path: '/2fa/enable',
    handler: 'enable2fa'
  },
  {
    method: 'POST',
    path: '/2fa/enable',
    handler: 'confirm2fa'
  },
  {
    method: 'POST',
    path: '/2fa/disable',
    handler: 'disable2fa'
  }
])
export default class UsersService implements Service {
  async logout(req: ServiceRequest): Promise<ServiceResponse> {
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

  @Validate({
    body: ['currentPassword', 'newPassword']
  })
  async changePassword(req: ServiceRequest): Promise<ServiceResponse> {
    const { currentPassword, newPassword } = req.body

    const em: EntityManager = req.ctx.em
    const user = await getUserFromToken(req.ctx)

    const passwordMatches = await bcrypt.compare(currentPassword, user.password)
    if (!passwordMatches) req.ctx.throw(401, 'Current password is incorrect')

    const isSamePassword = await bcrypt.compare(newPassword, user.password)
    if (isSamePassword) req.ctx.throw(400, 'Please choose a different password')

    user.password = await bcrypt.hash(newPassword, 10)
    const userSessionRepo = em.getRepository(UserSession)
    const sessions = await userSessionRepo.find({ user })
    await userSessionRepo.remove(sessions)

    const accessToken = await buildTokenPair(req.ctx, user)

    return {
      status: 200,
      body: {
        accessToken
      }
    }
  }

  async me(req: ServiceRequest): Promise<ServiceResponse> {
    const user = await getUserFromToken(req.ctx)

    return {
      status: 200,
      body: {
        user
      }
    }
  }

  @Validate({
    body: ['code']
  })
  async confirmEmail(req: ServiceRequest): Promise<ServiceResponse> {
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
    await em.getRepository(UserAccessCode).removeAndFlush(accessCode)

    return {
      status: 200,
      body: {
        user
      }
    }
  }

  async enable2fa(req: ServiceRequest): Promise<ServiceResponse> {
    const em: EntityManager = req.ctx.em

    const user = await getUserFromToken(req.ctx)

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

  @Validate({
    body: ['token']
  })
  async confirm2fa(req: ServiceRequest): Promise<ServiceResponse> {
    const { token } = req.body
    const em: EntityManager = req.ctx.em

    const user = await getUserFromToken(req.ctx, ['twoFactorAuth'])

    if (user.twoFactorAuth?.enabled) {
      req.ctx.throw(403, 'Two factor authentication is already enabled')
    }

    if (!authenticator.check(token, user.twoFactorAuth.secret)) {
      req.ctx.throw(403, 'Invalid token')
    }

    user.twoFactorAuth.enabled = true
    await em.flush()

    return {
      status: 200,
      body: {
        user
      }
    }
  }

  @Validate({
    body: ['password']
  })
  async disable2fa(req: ServiceRequest): Promise<ServiceResponse> {
    const { password } = req.body
    const em: EntityManager = req.ctx.em

    const user = await getUserFromToken(req.ctx, ['twoFactorAuth'])

    if (user.twoFactorAuth?.enabled) {
      req.ctx.throw(403, 'Two factor authentication is already enabled')
    }

    const passwordMatches = await bcrypt.compare(password, user.password)
    if (!passwordMatches) req.ctx.throw(401, 'Incorrect password')

    await em.removeAndFlush(user.twoFactorAuth)

    return {
      status: 200,
      body: {
        user
      }
    }
  }
}
