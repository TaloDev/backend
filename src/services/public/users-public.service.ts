import { Service, ServiceRequest, ServiceResponse, ServiceRoute } from 'koa-rest-services'

export const usersPublicRoutes: ServiceRoute[] = [
  {
    method: 'POST',
    path: '/register',
    handler: 'register'
  }
]

export default class UsersPublicService implements Service {
  async register(req: ServiceRequest): Promise<ServiceResponse> {
    
    return {
      status: 200
    }
  }
}
