import { EntityResource } from 'koa-rest-services'
import Player from '../entities/player'

export default class PlayerResource extends EntityResource<Player> {
  async transform(): Promise<any> {
    return {
      id: this.entity.id,
      props: this.entity.props,
      aliases: this.entity.aliases,
      gameId: this.entity.game.id,
      createdAt: this.entity.createdAt,
      lastSeenAt: this.entity.lastSeenAt
    }
  }
}
