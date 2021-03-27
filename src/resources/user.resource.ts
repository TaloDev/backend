import { EntityResource } from 'koa-rest-services'
import User from '../entities/user'
import OrganisationResource from './organisation.resource'

export default class UserResource extends EntityResource<User> {
  async transform(): Promise<any> {
    const organisation = await (new OrganisationResource(this.entity.organisation)).transform()

    return {
      id: this.entity.id,
      email: this.entity.email,
      lastSeenAt: this.entity.lastSeenAt,
      emailConfirmed: this.entity.emailConfirmed,
      organisation
    }
  }
}
