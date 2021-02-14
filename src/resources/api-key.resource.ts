import { EntityResource } from 'koa-rest-services'
import APIKey from '../entities/api-key'
import jwt from 'jsonwebtoken'
import { createToken } from '../services/api-keys.service'

export default class APIKeyResource extends EntityResource<APIKey> {
  async transform(): Promise<any> {
    const iat = new Date(this.entity.createdAt).getTime()
    const token = await createToken(this.entity, { iat: Math.floor(iat / 1000) })
    const createdBy = this.entity.createdByUser.email // todo, user name field

    return {
      id: this.entity.id,
      token: token.substring(token.length - 5, token.length),
      scopes: this.entity.scopes,
      createdBy,
      createdAt: this.entity.createdAt
    }
  }
}
