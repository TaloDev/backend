import { EntityManager } from '@mikro-orm/core'
import { ServiceRequest, ServiceResponse } from 'koa-rest-services'
import UserSession from '../entities/user-session'

export const usersRoutes = [
  {
    method: 'POST',
    path: '/logout',
    handler: 'logout'
  }
]

export default class UsersService {
  async logout(req: ServiceRequest): Promise<ServiceResponse> {
    const em: EntityManager = req.ctx.em
    const userId: number = req.ctx.state.user.sub

    const existingSession = await em.getRepository(UserSession).findOne({ user: userId })
    if (existingSession) await em.removeAndFlush(existingSession)
    req.ctx.cookies.set('refreshToken', null, { expires: new Date(0) })

    return {
      status: 200
    }
  }
}
