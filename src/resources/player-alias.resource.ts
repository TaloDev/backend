import { EntityResource } from 'koa-rest-services'
import PlayerAlias from '../entities/player-alias'

export default class PlayerAliasResource extends EntityResource<PlayerAlias> {
  async transform(): Promise<any> {
    return {
      id: this.entity.id,
      service: this.entity.service,
      identifier: this.entity.identifier
    }
  }
}
