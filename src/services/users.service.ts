import { EntityManager } from '@mikro-orm/core'
import { Resource, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import UserSession from '../entities/user-session'
import { buildTokenPair } from '../utils/auth'
import bcrypt from 'bcrypt'
import UserResource from '../resources/user.resource'
import getUserFromToken from '../utils/getUserFromToken'

export const usersRoutes = [
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
  }
]

export default class UsersService {
  async logout(req: ServiceRequest): Promise<ServiceResponse> {
    const em: EntityManager = req.ctx.em
    const userId: number = req.ctx.state.user.sub
    const userAgent: string = req.headers['user-agent']

    const sessions = await em.getRepository(UserSession).find({ user: userId, userAgent })
    if (sessions.length > 0) await em.removeAndFlush(sessions)
    req.ctx.cookies.set('refreshToken', null, { expires: new Date(0) })

    return {
      status: 204
    }
  }

  @Validate({
    body: {
      currentPassword: 'Missing body parameter: currentPassword',
      newPassword: 'Missing body parameter: newPassword'
    }
  })
  async changePassword(req: ServiceRequest): Promise<ServiceResponse> {
    const { currentPassword, newPassword } = req.body
    
    const em: EntityManager = req.ctx.em
    const user = await getUserFromToken(req.ctx)

    const passwordMatches = await bcrypt.compare(currentPassword, user.password)
    if (!passwordMatches) {
      req.ctx.throw(401, 'Current password is incorrect')
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password)
    if (isSamePassword) {
      req.ctx.throw(400, 'Please choose a different password')
    }

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

  @Resource(UserResource, 'user')
  async me(req: ServiceRequest): Promise<ServiceResponse> {
    const user = await getUserFromToken(req.ctx)
    if (!user) {
      req.ctx.throw(404, 'User not found')
    }

    return {
      status: 200,
      body: {
        user
      }
    }
  }

  async confirmEmail(req: ServiceRequest): Promise<ServiceResponse> {
    const user = await getUserFromToken(req.ctx)
    user.emailConfirmed = true
    await req.ctx.em.flush()

    return {
      status: 204
    }
  }
}
