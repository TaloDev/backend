import { EntityResource } from 'koa-rest-services'
import APIKey from '../entities/api-key'
import jwt from 'jsonwebtoken'

export default class APIKeyResource extends EntityResource<APIKey> {
  async transform(): Promise<any> {
    const iat = new Date(this.entity.createdAt).getTime()
    const payload = { sub: this.entity.id, scopes: this.entity.scopes, iat: Math.floor(iat / 1000) }
    const token = jwt.sign(payload, process.env.JWT_SECRET)

    return {
      id: this.entity.id,
      token: token.substring(token.length - 5, token.length),
      scopes: this.entity.scopes,
      createdAt: this.entity.createdAt
    }
  }
}
