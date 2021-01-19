import { EntityResource } from 'koa-rest-services'
import User from '../entities/user'

export default class UserResource extends EntityResource<User> {
  id: number
  lastSeenAt: Date

  constructor(entity: User) {
    super(entity)
    this.id = entity.id
    this.lastSeenAt = entity.lastSeenAt
  }
}
