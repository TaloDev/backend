import { EntityResource } from 'koa-rest-services'
import Player, { PlayerPrivacyScope } from '../entities/player'

export default class PlayerResource extends EntityResource<Player> {
  id: string
  privacyScope: PlayerPrivacyScope

  constructor(entity: Player) {
    super(entity)
    this.id = entity.id
    this.privacyScope = entity.privacyScope
  }
}
